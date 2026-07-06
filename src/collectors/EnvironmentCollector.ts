import os from 'os';
import type {
  EnvResponse,
  EnvPropertySource,
  ResolvedActuatorOptions,
} from '../core/types';

const DEFAULT_MASK_PATTERNS = [
  'PASSWORD',
  'SECRET',
  'KEY',
  'TOKEN',
  'AUTH',
  'CREDENTIAL',
  'PRIVATE',
  'SIGNATURE',
];

/** URI schemes that should have their credentials masked. */
const CREDENTIAL_URI_SCHEMES = [
  'mongodb://',
  'mongodb+srv://',
  'postgres://',
  'postgresql://',
  'mysql://',
  'redis://',
  'rediss://',
  'amqp://',
  'amqps://',
  'mssql://',
  'http://',
  'https://',
  'ftp://',
  'ftps://',
];

export class EnvironmentCollector {
  private patterns: string[];
  private additional: string[];
  private replacement: string;
  private allowlist: string[] | undefined;

  constructor(config: ResolvedActuatorOptions['env']) {
    this.patterns = config.mask.patterns;
    this.additional = config.mask.additional;
    this.replacement = config.mask.replacement;
    this.allowlist = config.mask.allowlist;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Full environment response (modelled after Spring Boot /actuator/env). */
  collect(): EnvResponse {
    return {
      activeProfiles: this.getActiveProfiles(),
      propertySources: [
        this.systemEnvironment(),
        this.systemProperties(),
      ],
    };
  }

  /** Look up a single environment variable by name (masked if sensitive). */
  variable(name: string): { name: string; value: string } | null {
    const raw = process.env[name];
    if (raw === undefined) return null;
    // Allowlist mode: variables not on the list are treated as non-existent.
    if (this.allowlist && !this.allowlist.includes(name)) return null;
    return {
      name,
      value: this.maskValue(name, raw),
    };
  }

  /** Dynamically add a mask pattern at runtime. */
  addMaskPattern(pattern: string): void {
    if (!this.patterns.includes(pattern)) this.patterns.push(pattern);
  }

  /** Dynamically add a specific variable name to mask. */
  addMaskVariable(name: string): void {
    if (!this.additional.includes(name)) this.additional.push(name);
  }

  /** Remove a mask pattern. */
  removeMaskPattern(pattern: string): void {
    this.patterns = this.patterns.filter((p) => p !== pattern);
  }

  /** Get current mask patterns. */
  getMaskPatterns(): string[] {
    return [...this.patterns];
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private getActiveProfiles(): string[] {
    const env = process.env['NODE_ENV'] || 'default';
    return [env];
  }

  private systemEnvironment(): EnvPropertySource {
    const properties: Record<string, { value: string }> = {};

    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue;
      // Allowlist mode: omit the variable entirely (including its name) unless
      // explicitly allowed. This avoids leaking the set of configured keys.
      if (this.allowlist && !this.allowlist.includes(key)) continue;
      properties[key] = {
        value: this.maskValue(key, val),
      };
    }

    return { name: 'systemEnvironment', properties };
  }

  private systemProperties(): EnvPropertySource {
    return {
      name: 'systemProperties',
      properties: {
        'node.version': { value: process.version },
        'node.platform': { value: process.platform },
        'node.arch': { value: process.arch },
        'os.hostname': { value: os.hostname() },
        'os.type': { value: os.type() },
        'os.release': { value: os.release() },
        'os.cpus': { value: String(os.cpus().length) },
        'os.totalMemory': { value: String(os.totalmem()) },
        'os.freeMemory': { value: String(os.freemem()) },
        'process.pid': { value: String(process.pid) },
        'process.uptime': { value: String(process.uptime()) },
        'process.cwd': { value: process.cwd() },
      },
    };
  }

  /**
   * Determine how to mask a value:
   * 1. If key matches mask patterns → fully mask
   * 2. If value is a connection string URI → smart-mask credentials only
   * 3. Otherwise → return raw value
   */
  private maskValue(key: string, value: string): string {
    if (this.shouldMask(key)) {
      // Even for fully-masked keys, try smart URI masking so host/port remain visible
      const uriMasked = this.maskConnectionString(value);
      if (uriMasked !== null) return uriMasked;
      return this.replacement;
    }
    // Even if key doesn't match patterns, connection strings should still be masked
    const uriMasked = this.maskConnectionString(value);
    if (uriMasked !== null) return uriMasked;
    return value;
  }

  /**
   * Smart URI masking: if the value is a connection string, parse it and mask
   * only the password portion. Host, port, and database remain visible for
   * debugging which instance a container is connected to.
   *
   * Example:
   *   mongodb://admin:s3cr3t@db.host.com:27017/mydb
   *   → mongodb://admin:******@db.host.com:27017/mydb
   */
  private maskConnectionString(value: string): string | null {
    const lower = value.toLowerCase();
    const isUri = CREDENTIAL_URI_SCHEMES.some((scheme) => lower.startsWith(scheme));
    if (!isUri) return null;

    try {
      const url = new URL(value);
      if (!url.password) return null; // no credentials to mask
      url.password = this.replacement;
      return url.toString();
    } catch {
      // Not a valid URL despite having a scheme prefix — try regex fallback
      // Pattern: scheme://user:password@host...
      const match = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:]+):([^@]+)@(.+)$/);
      if (match) {
        return `${match[1]}${match[2]}:${this.replacement}@${match[4]}`;
      }
      return null;
    }
  }

  private shouldMask(key: string): boolean {
    if (this.additional.includes(key)) return true;
    const upper = key.toUpperCase();
    return this.patterns.some((p) => upper.includes(p.toUpperCase()));
  }
}

export { DEFAULT_MASK_PATTERNS };

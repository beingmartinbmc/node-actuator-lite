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

export class EnvironmentCollector {
  private patterns: string[];
  private additional: string[];
  private replacement: string;

  constructor(config: ResolvedActuatorOptions['env']) {
    this.patterns = config.mask.patterns;
    this.additional = config.mask.additional;
    this.replacement = config.mask.replacement;
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
    return {
      name,
      value: this.shouldMask(name) ? this.replacement : raw,
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
      properties[key] = {
        value: this.shouldMask(key) ? this.replacement : val,
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

  private shouldMask(key: string): boolean {
    if (this.additional.includes(key)) return true;
    const upper = key.toUpperCase();
    return this.patterns.some((p) => upper.includes(p.toUpperCase()));
  }
}

export { DEFAULT_MASK_PATTERNS };

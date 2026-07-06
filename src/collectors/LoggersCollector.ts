import { logger, LOG_LEVELS } from '../utils/logger';
import type { LogLevel } from '../utils/logger';

// ============================================================================
// Loggers Collector
//
// Provides a Spring Boot–style /actuator/loggers endpoint that allows:
// - GET /loggers → list all configured loggers and their levels
// - GET /loggers/:name → get a specific logger's level
// - POST /loggers/:name { configuredLevel: "DEBUG" } → change level at runtime
//
// Supports adapters for Pino, Winston, Bunyan, and the built-in logger.
// ============================================================================

export type LoggerLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'OFF';

export interface LoggerInfo {
  configuredLevel: LoggerLevel | null;
  effectiveLevel: LoggerLevel;
}

export interface LoggersResponse {
  levels: LoggerLevel[];
  loggers: Record<string, LoggerInfo>;
}

/** Adapter interface for integrating external logging libraries. */
export interface LoggerAdapter {
  /** Unique name for this adapter (e.g. 'pino', 'winston', 'bunyan'). */
  name: string;
  /** Get the current level of a named logger. */
  getLevel(loggerName: string): LoggerLevel | null;
  /** Set the level of a named logger at runtime. Returns true on success. */
  setLevel(loggerName: string, level: LoggerLevel): boolean;
  /** List all known logger names. */
  listLoggers(): string[];
}

/**
 * Built-in adapter for node-actuator-lite's own internal logger.
 */
class BuiltinLoggerAdapter implements LoggerAdapter {
  readonly name = 'builtin';
  private currentLevel: LoggerLevel = 'WARN';

  constructor() {
    const envLevel = (process.env['ACTUATOR_LOG_LEVEL'] || 'WARN').toUpperCase();
    // LOG_LEVELS uses 'SILENT' internally; LoggerLevel (this public API) uses 'OFF'.
    if (envLevel === 'SILENT') {
      this.currentLevel = 'OFF';
    } else if (envLevel in LOG_LEVELS) {
      this.currentLevel = envLevel as LoggerLevel;
    }
  }

  getLevel(_loggerName: string): LoggerLevel {
    return this.currentLevel;
  }

  setLevel(_loggerName: string, level: LoggerLevel): boolean {
    const mapped = this.mapToLogLevel(level);
    if (!mapped) return false;
    logger.setLevel(mapped);
    this.currentLevel = level;
    return true;
  }

  listLoggers(): string[] {
    return ['ROOT'];
  }

  private mapToLogLevel(level: LoggerLevel): LogLevel | null {
    switch (level) {
      case 'TRACE': return 'TRACE';
      case 'DEBUG': return 'DEBUG';
      case 'INFO': return 'INFO';
      case 'WARN': return 'WARN';
      case 'ERROR': return 'ERROR';
      case 'OFF': return 'SILENT';
      default: return null;
    }
  }
}

/**
 * Pino adapter: wraps a Pino logger instance.
 * Usage: new PinoLoggerAdapter(pinoInstance)
 */
export class PinoLoggerAdapter implements LoggerAdapter {
  readonly name = 'pino';
  private pinoInstance: any;
  private childLoggers: Map<string, any> = new Map();

  constructor(pinoInstance: any) {
    this.pinoInstance = pinoInstance;
    this.childLoggers.set('ROOT', pinoInstance);
  }

  addChild(name: string, child: any): void {
    this.childLoggers.set(name, child);
  }

  getLevel(loggerName: string): LoggerLevel | null {
    const target = this.childLoggers.get(loggerName) ?? this.pinoInstance;
    const level = target?.level ?? target?.levelVal;
    return this.pinoLevelToLoggerLevel(typeof level === 'string' ? level : null);
  }

  setLevel(loggerName: string, level: LoggerLevel): boolean {
    const target = this.childLoggers.get(loggerName) ?? this.pinoInstance;
    if (!target) return false;
    const pinoLevel = this.loggerLevelToPino(level);
    if (!pinoLevel) return false;
    target.level = pinoLevel;
    return true;
  }

  listLoggers(): string[] {
    return [...this.childLoggers.keys()];
  }

  private pinoLevelToLoggerLevel(level: string | null): LoggerLevel | null {
    switch (level) {
      case 'trace': return 'TRACE';
      case 'debug': return 'DEBUG';
      case 'info': return 'INFO';
      case 'warn': return 'WARN';
      case 'error': case 'fatal': return 'ERROR';
      case 'silent': return 'OFF';
      default: return null;
    }
  }

  private loggerLevelToPino(level: LoggerLevel): string | null {
    switch (level) {
      case 'TRACE': return 'trace';
      case 'DEBUG': return 'debug';
      case 'INFO': return 'info';
      case 'WARN': return 'warn';
      case 'ERROR': return 'error';
      case 'OFF': return 'silent';
      default: return null;
    }
  }
}

/**
 * Winston adapter: wraps a Winston logger instance.
 * Usage: new WinstonLoggerAdapter(winstonLogger)
 */
export class WinstonLoggerAdapter implements LoggerAdapter {
  readonly name = 'winston';
  private winstonInstance: any;
  private childLoggers: Map<string, any> = new Map();

  constructor(winstonInstance: any) {
    this.winstonInstance = winstonInstance;
    this.childLoggers.set('ROOT', winstonInstance);
  }

  addChild(name: string, child: any): void {
    this.childLoggers.set(name, child);
  }

  getLevel(loggerName: string): LoggerLevel | null {
    const target = this.childLoggers.get(loggerName) ?? this.winstonInstance;
    if (target?.silent) return 'OFF';
    const level = target?.level;
    return this.winstonLevelToLoggerLevel(level);
  }

  setLevel(loggerName: string, level: LoggerLevel): boolean {
    const target = this.childLoggers.get(loggerName) ?? this.winstonInstance;
    if (!target) return false;
    if (level === 'OFF') {
      target.silent = true;
      return true;
    }
    const winstonLevel = this.loggerLevelToWinston(level);
    if (winstonLevel === null) return false;
    target.level = winstonLevel;
    target.silent = false;
    return true;
  }

  listLoggers(): string[] {
    return [...this.childLoggers.keys()];
  }

  private winstonLevelToLoggerLevel(level: string | undefined): LoggerLevel | null {
    switch (level) {
      case 'silly': case 'verbose': return 'TRACE';
      case 'debug': return 'DEBUG';
      case 'info': return 'INFO';
      case 'warn': case 'warning': return 'WARN';
      case 'error': case 'crit': case 'alert': case 'emerg': return 'ERROR';
      default: return null;
    }
  }

  private loggerLevelToWinston(level: LoggerLevel): string | null {
    switch (level) {
      case 'TRACE': return 'silly';
      case 'DEBUG': return 'debug';
      case 'INFO': return 'info';
      case 'WARN': return 'warn';
      case 'ERROR': return 'error';
      default: return null;
    }
  }
}

/**
 * Bunyan adapter: wraps a Bunyan logger instance.
 * Usage: new BunyanLoggerAdapter(bunyanLogger)
 */
export class BunyanLoggerAdapter implements LoggerAdapter {
  readonly name = 'bunyan';
  private bunyanInstance: any;
  private childLoggers: Map<string, any> = new Map();

  constructor(bunyanInstance: any) {
    this.bunyanInstance = bunyanInstance;
    this.childLoggers.set('ROOT', bunyanInstance);
  }

  addChild(name: string, child: any): void {
    this.childLoggers.set(name, child);
  }

  getLevel(loggerName: string): LoggerLevel | null {
    const target = this.childLoggers.get(loggerName) ?? this.bunyanInstance;
    const level = target?.level?.();
    return this.bunyanLevelToLoggerLevel(level);
  }

  setLevel(loggerName: string, level: LoggerLevel): boolean {
    const target = this.childLoggers.get(loggerName) ?? this.bunyanInstance;
    if (!target) return false;
    if (level === 'OFF') {
      // Bunyan's named levels top out at 'fatal' (60) which still emits.
      // Setting a numeric level above FATAL silences the logger completely.
      target.level(Number.MAX_SAFE_INTEGER);
      return true;
    }
    const bunyanLevel = this.loggerLevelToBunyan(level);
    if (bunyanLevel === null) return false;
    target.level(bunyanLevel);
    return true;
  }

  listLoggers(): string[] {
    return [...this.childLoggers.keys()];
  }

  private bunyanLevelToLoggerLevel(level: number | undefined): LoggerLevel | null {
    if (level === undefined) return null;
    if (level <= 10) return 'TRACE';
    if (level <= 20) return 'DEBUG';
    if (level <= 30) return 'INFO';
    if (level <= 40) return 'WARN';
    if (level <= 50) return 'ERROR';
    return 'OFF';
  }

  private loggerLevelToBunyan(level: LoggerLevel): string | null {
    switch (level) {
      case 'TRACE': return 'trace';
      case 'DEBUG': return 'debug';
      case 'INFO': return 'info';
      case 'WARN': return 'warn';
      case 'ERROR': return 'error';
      default: return null;
    }
  }
}

export class LoggersCollector {
  private adapters: LoggerAdapter[] = [];
  private builtinAdapter: BuiltinLoggerAdapter;

  constructor() {
    this.builtinAdapter = new BuiltinLoggerAdapter();
    this.adapters.push(this.builtinAdapter);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Register an external logger adapter (Pino, Winston, Bunyan). */
  addAdapter(adapter: LoggerAdapter): void {
    // Remove any existing adapter with the same name
    this.adapters = this.adapters.filter((a) => a.name !== adapter.name);
    this.adapters.push(adapter);
  }

  /** Remove an adapter by name. */
  removeAdapter(name: string): boolean {
    if (name === 'builtin') return false; // cannot remove built-in
    const before = this.adapters.length;
    this.adapters = this.adapters.filter((a) => a.name !== name);
    return this.adapters.length < before;
  }

  /** List all configured loggers across all adapters. */
  collect(): LoggersResponse {
    const loggers: Record<string, LoggerInfo> = {};

    for (const adapter of this.adapters) {
      for (const name of adapter.listLoggers()) {
        const qualifiedName = this.adapters.length > 1
          ? `${adapter.name}:${name}`
          : name;
        const level = adapter.getLevel(name);
        loggers[qualifiedName] = {
          configuredLevel: level,
          effectiveLevel: level ?? 'INFO',
        };
      }
    }

    return {
      levels: ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'],
      loggers,
    };
  }

  /** Get a specific logger by qualified name. */
  getLogger(qualifiedName: string): LoggerInfo | null {
    const { adapter, loggerName, found } = this.resolveQualifiedName(qualifiedName);
    if (!adapter || !found) return null;

    const level = adapter.getLevel(loggerName);

    return {
      configuredLevel: level,
      effectiveLevel: level ?? 'INFO',
    };
  }

  /** Set the level of a specific logger by qualified name. */
  setLevel(qualifiedName: string, level: LoggerLevel): boolean {
    const { adapter, loggerName, found } = this.resolveQualifiedName(qualifiedName);
    if (!adapter || !found) return false;
    return adapter.setLevel(loggerName, level);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private resolveQualifiedName(qualifiedName: string): {
    adapter: LoggerAdapter | null;
    loggerName: string;
    found: boolean;
  } {
    // Format: "adapterName:loggerName" or just "loggerName" (defaults to first adapter)
    const colonIdx = qualifiedName.indexOf(':');
    if (colonIdx > 0) {
      const adapterName = qualifiedName.slice(0, colonIdx);
      const loggerName = qualifiedName.slice(colonIdx + 1);
      const adapter = this.adapters.find((a) => a.name === adapterName) ?? null;
      if (!adapter) return { adapter: null, loggerName, found: false };
      const found = adapter.listLoggers().includes(loggerName);
      return { adapter, loggerName, found };
    }
    // No qualifier — search all adapters, return first match
    for (const adapter of this.adapters) {
      if (adapter.listLoggers().includes(qualifiedName)) {
        return { adapter, loggerName: qualifiedName, found: true };
      }
    }
    return { adapter: null, loggerName: qualifiedName, found: false };
  }
}

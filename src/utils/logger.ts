export const LOG_LEVELS = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  SILENT: 60,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/** Minimal logger contract consumers can implement to plug in pino/winston/etc. */
export interface LoggerLike {
  trace(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

class Logger implements LoggerLike {
  private level: number;
  private delegate: LoggerLike | null = null;

  constructor() {
    const envLevel = (process.env['ACTUATOR_LOG_LEVEL'] || 'WARN').toUpperCase() as LogLevel;
    this.level = LOG_LEVELS[envLevel] ?? LOG_LEVELS.WARN;
  }

  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  /**
   * Route all log output through a custom logger. Pass `null` to restore the
   * built-in JSON console logger.
   */
  setDelegate(delegate: LoggerLike | null): void {
    this.delegate = delegate;
  }

  private log(level: LogLevel, msg: string, data?: unknown): void {
    if (this.delegate) {
      const fn = level === 'SILENT' ? undefined : this.delegate[lowerLevel(level)];
      if (fn) fn.call(this.delegate, msg, data);
      return;
    }

    if (LOG_LEVELS[level] < this.level) return;

    const entry = {
      time: new Date().toISOString(),
      level,
      msg,
      ...(data !== undefined && { data }),
    };

    const line = JSON.stringify(entry);

    if (LOG_LEVELS[level] >= LOG_LEVELS.ERROR) {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  trace(msg: string, data?: unknown): void { this.log('TRACE', msg, data); }
  debug(msg: string, data?: unknown): void { this.log('DEBUG', msg, data); }
  info(msg: string, data?: unknown): void  { this.log('INFO', msg, data); }
  warn(msg: string, data?: unknown): void  { this.log('WARN', msg, data); }
  error(msg: string, data?: unknown): void { this.log('ERROR', msg, data); }
}

function lowerLevel(level: Exclude<LogLevel, 'SILENT'>): keyof LoggerLike;
function lowerLevel(level: LogLevel): keyof LoggerLike | undefined;
function lowerLevel(level: LogLevel): keyof LoggerLike | undefined {
  switch (level) {
    case 'TRACE': return 'trace';
    case 'DEBUG': return 'debug';
    case 'INFO': return 'info';
    case 'WARN': return 'warn';
    case 'ERROR': return 'error';
    default: return undefined;
  }
}

export const logger = new Logger();

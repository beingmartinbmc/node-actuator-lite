export const LOG_LEVELS = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  SILENT: 60,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

class Logger {
  private level: number;

  constructor() {
    const envLevel = (process.env['ACTUATOR_LOG_LEVEL'] || 'WARN').toUpperCase() as LogLevel;
    this.level = LOG_LEVELS[envLevel] ?? LOG_LEVELS.WARN;
  }

  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  private log(level: LogLevel, msg: string, data?: any): void {
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

  trace(msg: string, data?: any): void { this.log('TRACE', msg, data); }
  debug(msg: string, data?: any): void { this.log('DEBUG', msg, data); }
  info(msg: string, data?: any): void  { this.log('INFO', msg, data); }
  warn(msg: string, data?: any): void  { this.log('WARN', msg, data); }
  error(msg: string, data?: any): void { this.log('ERROR', msg, data); }
}

export const logger = new Logger();

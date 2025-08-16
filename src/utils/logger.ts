// Lightweight logger using Node.js built-ins
export interface LogLevel {
  level: number;
  name: string;
}

export const LOG_LEVELS = {
  TRACE: { level: 10, name: 'TRACE' },
  DEBUG: { level: 20, name: 'DEBUG' },
  INFO: { level: 30, name: 'INFO' },
  WARN: { level: 40, name: 'WARN' },
  ERROR: { level: 50, name: 'ERROR' },
  FATAL: { level: 60, name: 'FATAL' }
} as const;

export type LogLevelName = keyof typeof LOG_LEVELS;

class LightweightLogger {
  private level: number;
  private isDevelopment: boolean;

  constructor() {
    this.level = LOG_LEVELS[process.env['LOG_LEVEL'] as LogLevelName]?.level || LOG_LEVELS.INFO.level;
    this.isDevelopment = process.env['NODE_ENV'] === 'development';
  }

  private formatMessage(level: LogLevelName, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const hostname = require('os').hostname();
    
    let logLine = `{"level":${LOG_LEVELS[level].level},"time":"${timestamp}","pid":${pid},"hostname":"${hostname}","msg":"${message}"`;
    
    if (data) {
      logLine += `,"data":${JSON.stringify(data)}`;
    }
    
    logLine += '}';
    return logLine;
  }

  private shouldLog(level: LogLevelName): boolean {
    return LOG_LEVELS[level].level >= this.level;
  }

  private log(level: LogLevelName, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, data);
    
    if (this.isDevelopment) {
      // Pretty print in development
      const color = {
        TRACE: '\x1b[90m', // gray
        DEBUG: '\x1b[36m', // cyan
        INFO: '\x1b[32m',  // green
        WARN: '\x1b[33m',  // yellow
        ERROR: '\x1b[31m', // red
        FATAL: '\x1b[35m'  // magenta
      }[level];
      
      const reset = '\x1b[0m';
      const timestamp = new Date().toISOString();
      console.log(`${color}[${timestamp}] ${level}:${reset} ${message}${data ? ` ${JSON.stringify(data, null, 2)}` : ''}`);
    } else {
      // JSON format in production
      console.log(formattedMessage);
    }
  }

  trace(message: string, data?: any): void {
    this.log('TRACE', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: any): void {
    this.log('ERROR', message, data);
  }

  fatal(message: string, data?: any): void {
    this.log('FATAL', message, data);
  }
}

const logger = new LightweightLogger();
export default logger; 
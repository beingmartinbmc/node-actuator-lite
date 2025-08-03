import pino from 'pino';

// Create a lightweight logger with minimal overhead
const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  ...(process.env['NODE_ENV'] === 'development' ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  } : {}),
  base: {
    pid: process.pid,
    hostname: require('os').hostname()
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export default logger; 
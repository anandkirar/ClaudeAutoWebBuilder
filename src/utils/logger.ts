import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

export class Logger {
  private winston: winston.Logger;
  private logLevel: string;

  constructor(logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.logLevel = logLevel;
    this.winston = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logDir = path.join(process.cwd(), 'logs');
    fs.ensureDirSync(logDir);

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
      })
    );

    return winston.createLogger({
      level: this.logLevel,
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          )
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'framework.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'errors.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          tailable: true
        })
      ]
    });
  }

  debug(message: string, ...args: any[]): void {
    this.winston.debug(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.winston.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.winston.warn(message, ...args);
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    if (error && error.stack) {
      this.winston.error(message, { stack: error.stack, ...args });
    } else {
      this.winston.error(message, error, ...args);
    }
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
    this.winston.level = level;
  }

  createChildLogger(context: string): Logger {
    const childLogger = new Logger(this.logLevel as any);
    childLogger.winston = this.winston.child({ context });
    return childLogger;
  }
}
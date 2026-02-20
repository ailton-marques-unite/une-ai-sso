import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';

/** Injection token for AppLogger so it can be injected without replacing Nest's default Logger. */
export const APP_LOGGER = 'AppLogger';

export class AppLogger implements LoggerService {
  private logger: winston.Logger;

  constructor(context?: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        winston.format.printf(
          ({ timestamp, level, message, context, domainId, ...meta }) => {
            const contextStr = context ? `[${context}]` : '';
            const domainStr = domainId ? `[Domain:${domainId}]` : '';
            return `${timestamp} ${level.toUpperCase()} ${contextStr} ${domainStr} ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta) : ''
            }`;
          },
        ),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  log(message: string, context?: string, domainId?: string) {
    this.logger.info(message, { context, domainId });
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    domainId?: string,
  ) {
    this.logger.error(message, { trace, context, domainId });
  }

  warn(message: string, context?: string, domainId?: string) {
    this.logger.warn(message, { context, domainId });
  }

  debug(message: string, context?: string, domainId?: string) {
    this.logger.debug(message, { context, domainId });
  }

  verbose(message: string, context?: string, domainId?: string) {
    this.logger.verbose(message, { context, domainId });
  }
}

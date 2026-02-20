import { Injectable, Inject } from '@nestjs/common';
import { AppLogger, APP_LOGGER } from './shared/utils/logger';

@Injectable()
export class AppService {
  private readonly context = AppService.name;

  constructor(
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  healthCheck(): string {
    this.logger.debug('healthCheck', this.context);
    return JSON.stringify({
      uptime: `${process.uptime()} ms`,
      message: 'Health check: OK',
      timestamp: new Date().toISOString(),
    });
  }
}

import { Global, Module } from '@nestjs/common';
import { AppLogger, APP_LOGGER } from '../utils/logger';

@Global()
@Module({
  providers: [
    {
      provide: APP_LOGGER,
      useClass: AppLogger,
    },
  ],
  exports: [APP_LOGGER],
})
export class LoggerModule {}

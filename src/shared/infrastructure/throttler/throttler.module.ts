import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { throttlerConfig } from './throttler.config';
import { ThrottlerStorageRedis } from './throttler-storage-redis';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { Redis } from 'ioredis';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RedisModule],
      useFactory: (configService: ConfigService, redisClient: Redis) => {
        const storage = new ThrottlerStorageRedis(redisClient);
        const config = throttlerConfig(configService);
        return {
          ...config,
          storage,
        };
      },
      inject: [ConfigService, 'REDIS_CLIENT'],
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}

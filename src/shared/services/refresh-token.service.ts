import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { AppLogger, APP_LOGGER } from '../utils/logger';

@Injectable()
export class RefreshTokenService {
  private readonly context = RefreshTokenService.name;
  private readonly refreshTokenTtl: number;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {
    // Converter JWT_REFRESH_TOKEN_EXPIRES_IN (ex: "7d") para segundos
    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    );
    this.refreshTokenTtl = this.parseExpiresIn(expiresIn);
  }

  async storeRefreshToken(
    domainId: string,
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    this.logger.debug('storeRefreshToken started', this.context, domainId);
    const key = `refresh_token:${domainId}:${userId}:${refreshToken}`;
    await this.redisClient.setex(key, this.refreshTokenTtl, userId);
  }

  async validateRefreshToken(
    domainId: string,
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    this.logger.debug('validateRefreshToken started', this.context, domainId);
    const key = `refresh_token:${domainId}:${userId}:${refreshToken}`;
    const stored = await this.redisClient.get(key);
    return stored === userId;
  }

  async revokeRefreshToken(
    domainId: string,
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    this.logger.debug('revokeRefreshToken started', this.context, domainId);
    const key = `refresh_token:${domainId}:${userId}:${refreshToken}`;
    await this.redisClient.del(key);
  }

  async revokeAllUserTokens(domainId: string, userId: string): Promise<void> {
    this.logger.log('revokeAllUserTokens started', this.context, domainId);
    const pattern = `refresh_token:${domainId}:${userId}:*`;
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
    this.logger.log('revokeAllUserTokens completed', this.context, domainId);
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60; // Default: 7 dias em segundos
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}

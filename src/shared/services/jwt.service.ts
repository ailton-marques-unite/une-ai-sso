import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/domain/entities/user.entity';
import { AppLogger, APP_LOGGER } from '../utils/logger';

export interface JwtPayload {
  sub: string; // user_id
  email: string;
  domain_id: string;
  domain_slug?: string;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class AppJwtService {
  private readonly context = AppJwtService.name;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  async generateAccessToken(user: User, domainSlug?: string): Promise<string> {
    this.logger.debug('generateAccessToken started', this.context, user?.domain_id);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      domain_id: user.domain_id,
      domain_slug: domainSlug,
    };

    const expiresIn = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRES_IN',
      '1h',
    );

    return this.jwtService.signAsync(payload, {
      expiresIn,
    });
  }

  async generateRefreshToken(user: User, domainSlug?: string): Promise<string> {
    this.logger.debug('generateRefreshToken started', this.context, user?.domain_id);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      domain_id: user.domain_id,
      domain_slug: domainSlug,
    };

    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    );

    return this.jwtService.signAsync(payload, {
      expiresIn,
    });
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    this.logger.debug('verifyToken started', this.context);
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch (error) {
      this.logger.warn('verifyToken failed: token invalid or expired', this.context);
      throw new UnauthorizedException('Token invalid or expired');
    }
  }

  async decodeToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.decode<JwtPayload>(token);
    } catch (error) {
      return null;
    }
  }
}

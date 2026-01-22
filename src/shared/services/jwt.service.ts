import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/domain/entities/user.entity';

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
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(user: User, domainSlug?: string): Promise<string> {
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
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch (error) {
      throw new UnauthorizedException('Token inválido ou expirado');
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

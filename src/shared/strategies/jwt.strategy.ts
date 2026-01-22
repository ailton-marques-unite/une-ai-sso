import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../../shared/services/jwt.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    // Validar que o domain_id do token corresponde ao domain_id da requisição
    const domainContext = (req as any).domainContext;
    
    if (!domainContext) {
      throw new UnauthorizedException('Domain context não encontrado');
    }

    if (payload.domain_id !== domainContext.domainId) {
      throw new UnauthorizedException(
        'Token não pertence a este domínio',
      );
    }

    return {
      sub: payload.sub,
      email: payload.email,
      domain_id: payload.domain_id,
      domain_slug: payload.domain_slug,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}

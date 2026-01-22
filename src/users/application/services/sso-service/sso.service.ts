import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { UserService } from '../user-service/user.service';
import { AppJwtService } from '../../../../shared/services/jwt.service';
import { RefreshTokenService } from '../../../../shared/services/refresh-token.service';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { User } from '../../../domain/entities/user.entity';
import axios from 'axios';

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
}

@Injectable()
export class SsoService {
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly googleRedirectUri: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
    private readonly jwtService: AppJwtService,
    private readonly refreshTokenService: RefreshTokenService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    this.googleRedirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || '';
  }

  async initiateGoogleOAuth(domainId?: string): Promise<{
    authUrl: string;
    state: string;
  }> {
    if (!this.googleClientId || !this.googleClientSecret) {
      throw new BadRequestException('Google OAuth não configurado');
    }

    // Gerar state aleatório
    const state = randomBytes(32).toString('hex');

    // Armazenar state no Redis com domain_id (se fornecido) por 10 minutos
    const stateKey = `sso_state:${state}`;
    await this.redisClient.setex(stateKey, 600, domainId || '');

    // Construir URL de autorização
    const params = new URLSearchParams({
      client_id: this.googleClientId,
      redirect_uri: this.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return { authUrl, state };
  }

  async handleGoogleCallback(
    code: string,
    state: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    // Validar state
    const stateKey = `sso_state:${state}`;
    const storedDomainId = await this.redisClient.get(stateKey);
    
    if (!storedDomainId) {
      throw new BadRequestException('State inválido ou expirado');
    }

    // Remover state usado
    await this.redisClient.del(stateKey);

    // Trocar código por access token
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        redirect_uri: this.googleRedirectUri,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const { access_token: googleAccessToken } = tokenResponse.data;

    // Buscar informações do usuário no Google
    const userInfoResponse = await axios.get<GoogleUserInfo>(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      },
    );

    const googleUser = userInfoResponse.data;

    // Domain discovery via email domain
    const emailDomain = googleUser.email.split('@')[1];
    let domainId = storedDomainId;

    // Se não foi fornecido domain_id no state, tentar descobrir pelo email domain
    if (!domainId || domainId === '') {
      const domain = await this.domainRepository.findOne({
        where: { slug: emailDomain.replace(/\./g, '-') }, // Tentar match por slug
      });

      if (domain) {
        domainId = domain.id;
      } else {
        throw new NotFoundException(
          `Domínio não encontrado para o email ${googleUser.email}. Entre em contato com o administrador.`,
        );
      }
    }

    // Verificar se domínio existe e está ativo
    const domain = await this.domainRepository.findOne({
      where: { id: domainId, is_active: true },
    });

    if (!domain) {
      throw new NotFoundException('Domínio não encontrado ou inativo');
    }

    // Buscar ou criar usuário
    let user = await this.userService.findByEmail(domainId, googleUser.email);

    if (!user) {
      // Criar usuário automaticamente usando repository diretamente
      user = this.userRepository.create({
        domain_id: domainId,
        email: googleUser.email,
        full_name: googleUser.name,
        is_verified: googleUser.verified_email,
        password_hash: null, // Sem senha para usuários SSO
      });
      user = await this.userRepository.save(user);
    } else {
      // Atualizar informações se necessário
      if (!user.is_verified && googleUser.verified_email) {
        await this.userRepository.update({ id: user.id }, {
          is_verified: true,
        });
        user.is_verified = true;
      }
    }

    // Atualizar último login
    await this.userService.updateLastLogin(domainId, user.id);

    // Gerar tokens JWT
    const accessToken = await this.jwtService.generateAccessToken(
      user,
      domain.slug,
    );
    const refreshToken = await this.jwtService.generateRefreshToken(
      user,
      domain.slug,
    );

    // Armazenar refresh token
    await this.refreshTokenService.storeRefreshToken(
      domainId,
      user.id,
      refreshToken,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }
}

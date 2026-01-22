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

export interface MicrosoftUserInfo {
  id: string;
  mail: string;
  userPrincipalName: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  tenantId?: string;
}

@Injectable()
export class SsoService {
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly googleRedirectUri: string;
  private readonly microsoftClientId: string;
  private readonly microsoftClientSecret: string;
  private readonly microsoftTenantId: string;
  private readonly microsoftRedirectUri: string;

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
    this.microsoftClientId = this.configService.get<string>('MICROSOFT_CLIENT_ID') || '';
    this.microsoftClientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET') || '';
    this.microsoftTenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';
    this.microsoftRedirectUri = this.configService.get<string>('MICROSOFT_REDIRECT_URI') || '';
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
    
    if (storedDomainId === null || storedDomainId === undefined) {
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
    let domain: Domain | null = null;

    // Se domain_id foi fornecido no state, usar ele
    if (domainId && domainId !== '') {
      domain = await this.domainRepository.findOne({
        where: { id: domainId, is_active: true },
      });
    }

    // Se não encontrou por domain_id ou não foi fornecido, tentar descobrir pelo email domain
    if (!domain) {
      // Tentar múltiplas estratégias de matching
      // 1. Slug exato do email domain (ex: "company.com" -> slug "company.com")
      domain = await this.domainRepository.findOne({
        where: { slug: emailDomain, is_active: true },
      });

      // 2. Slug com pontos substituídos por hífens (ex: "company.com" -> slug "company-com")
      if (!domain) {
        domain = await this.domainRepository.findOne({
          where: { slug: emailDomain.replace(/\./g, '-'), is_active: true },
        });
      }

      // 3. Slug apenas com a primeira parte do email domain (ex: "company.com" -> slug "company")
      if (!domain) {
        const firstPart = emailDomain.split('.')[0];
        domain = await this.domainRepository.findOne({
          where: { slug: firstPart, is_active: true },
      });
      }

      if (domain) {
        domainId = domain.id;
      } else {
        throw new NotFoundException(
          `Domínio não encontrado para o email ${googleUser.email}. ` +
          `Verifique se o domínio está cadastrado e ativo, ou forneça o domain_id no parâmetro da requisição.`,
        );
      }
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

  async initiateMicrosoftOAuth(domainId?: string): Promise<{
    authUrl: string;
    state: string;
  }> {
    if (!this.microsoftClientId || !this.microsoftClientSecret) {
      throw new BadRequestException('Microsoft OAuth não configurado');
    }

    // Gerar state aleatório
    const state = randomBytes(32).toString('hex');

    // Armazenar state no Redis com domain_id (se fornecido) por 10 minutos
    const stateKey = `sso_state:${state}`;
    await this.redisClient.setex(stateKey, 600, domainId || '');

    // Construir URL de autorização Microsoft
    const tenant = this.microsoftTenantId || 'common';
    const params = new URLSearchParams({
      client_id: this.microsoftClientId,
      response_type: 'code',
      redirect_uri: this.microsoftRedirectUri,
      response_mode: 'query',
      scope: 'openid email profile User.Read',
      state,
      prompt: 'select_account',
    });

    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

    return { authUrl, state };
  }

  async handleMicrosoftCallback(
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
    
    if (storedDomainId === null || storedDomainId === undefined) {
      throw new BadRequestException('State inválido ou expirado');
    }

    // Remover state usado
    await this.redisClient.del(stateKey);

    const tenant = this.microsoftTenantId || 'common';

    // Trocar código por access token
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: this.microsoftClientId,
        client_secret: this.microsoftClientSecret,
        code,
        redirect_uri: this.microsoftRedirectUri,
        grant_type: 'authorization_code',
        scope: 'openid email profile User.Read',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const { access_token: microsoftAccessToken } = tokenResponse.data;

    // Buscar informações do usuário no Microsoft Graph
    const userInfoResponse = await axios.get<MicrosoftUserInfo>(
      'https://graph.microsoft.com/v1.0/me',
      {
        headers: {
          Authorization: `Bearer ${microsoftAccessToken}`,
        },
      },
    );

    const microsoftUser = userInfoResponse.data;
    const email = microsoftUser.mail || microsoftUser.userPrincipalName;

    if (!email) {
      throw new BadRequestException('Email não encontrado no perfil Microsoft');
    }

    // Domain discovery via Tenant ID ou domain_id fornecido
    let domainId = storedDomainId;
    let domain: Domain | null = null;

    // Se domain_id foi fornecido no state, usar ele
    if (domainId && domainId !== '') {
      domain = await this.domainRepository.findOne({
        where: { id: domainId, is_active: true },
      });
    }

    // Se não encontrou por domain_id ou não foi fornecido, tentar descobrir via Tenant ID
    if (!domain && microsoftUser.tenantId) {
      domain = await this.domainRepository.findOne({
        where: { ms_tenant_id: microsoftUser.tenantId, is_active: true },
      });
    }

    if (!domain) {
      throw new NotFoundException(
        `Domínio não encontrado para o tenant Microsoft ${microsoftUser.tenantId || 'desconhecido'}. Entre em contato com o administrador.`,
      );
    }

    domainId = domain.id;

    // Buscar ou criar usuário
    let user = await this.userService.findByEmail(domainId, email);

    if (!user) {
      // Criar usuário automaticamente
      user = this.userRepository.create({
        domain_id: domainId,
        email,
        full_name: microsoftUser.displayName || `${microsoftUser.givenName || ''} ${microsoftUser.surname || ''}`.trim(),
        is_verified: true, // Microsoft já verifica emails
        password_hash: null, // Sem senha para usuários SSO
      });
      user = await this.userRepository.save(user);
    } else {
      // Atualizar informações se necessário
      if (!user.is_verified) {
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

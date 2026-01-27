import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../user-service/user.service';
import { PasswordService } from '../../../../shared/services/password.service';
import { AppJwtService } from '../../../../shared/services/jwt.service';
import { RefreshTokenService } from '../../../../shared/services/refresh-token.service';
import { LoginDto } from '../../dtos/login.dto';
import { LoginResponseDto } from '../../dtos/login-response.dto';
import { CreateUserDto } from '../../dtos/create-user.dto';
import { UserResponseDto } from '../../dtos/user-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { MfaService } from '../mfa-service/mfa.service';
import { MfaType } from '../../../domain/entities/user-mfa.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: AppJwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly mfaService: MfaService,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
  ) {}

  async register(
    domainId: string,
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    // Verificar se domínio existe e está ativo
    const domain = await this.domainRepository.findOne({
      where: { id: domainId, is_active: true },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found or inactive');
    }

    return this.userService.create(domainId, createUserDto);
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { domain_id, email, password } = loginDto;

    // Verificar se domínio existe e está ativo
    const domain = await this.domainRepository.findOne({
      where: { id: domain_id, is_active: true },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found or inactive');
    }

    // Buscar usuário
    const user = await this.userService.findByEmail(domain_id, email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verificar se usuário está ativo
    if (!user.is_active) {
      throw new UnauthorizedException('User inactive');
    }

    // Verificar senha
    if (!user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verificar se MFA está habilitado
    if (user.mfa_enabled) {
      // Gerar token temporário para MFA (15 minutos)
      const mfaToken = await this.jwtService.generateAccessToken(
        user,
        domain.slug,
      );

      // Armazenar temporariamente no Redis (15 minutos)
      const redisKey = `mfa_challenge:${domain_id}:${user.id}:${mfaToken}`;
      const redisClient = this.refreshTokenService['redisClient'];
      await redisClient.setex(redisKey, 900, JSON.stringify({ userId: user.id, domainId: domain_id }));

      // Determinar métodos MFA disponíveis
      const availableMethods: string[] = [];
      // TODO: Verificar métodos configurados do usuário
      // Por enquanto, assumir TOTP como padrão
      availableMethods.push(MfaType.TOTP);

      return {
        mfa_required: true,
        mfa_token: mfaToken,
        available_methods: availableMethods,
          message: 'MFA is required. Please provide the MFA code.',
        };
    }

    // Atualizar último login
    await this.userService.updateLastLogin(domain_id, user.id);

    // Gerar tokens
    const accessToken = await this.jwtService.generateAccessToken(
      user,
      domain.slug,
    );
    const refreshToken = await this.jwtService.generateRefreshToken(
      user,
      domain.slug,
    );

    // Armazenar refresh token no Redis
    await this.refreshTokenService.storeRefreshToken(
      domain_id,
      user.id,
      refreshToken,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 1 hora
      token_type: 'Bearer',
      mfa_required: false,
    };
  }

  async refreshToken(
    domainId: string,
    refreshToken: string,
  ): Promise<LoginResponseDto> {
    // Verificar token
    const payload = await this.jwtService.verifyToken(refreshToken);

    // Validar domain_id
    if (payload.domain_id !== domainId) {
      throw new UnauthorizedException('Token does not belong to this domain');
    }

    // Validar refresh token no Redis
    const isValid = await this.refreshTokenService.validateRefreshToken(
      domainId,
      payload.sub,
      refreshToken,
    );

    if (!isValid) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Buscar usuário
    const user = await this.userService.findByEmail(domainId, payload.email);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Buscar domínio
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });

    // Gerar novos tokens
    const newAccessToken = await this.jwtService.generateAccessToken(
      user,
      domain?.slug,
    );
    const newRefreshToken = await this.jwtService.generateRefreshToken(
      user,
      domain?.slug,
    );

    // Revogar token antigo e armazenar novo
    await this.refreshTokenService.revokeRefreshToken(
      domainId,
      payload.sub,
      refreshToken,
    );
    await this.refreshTokenService.storeRefreshToken(
      domainId,
      user.id,
      newRefreshToken,
    );

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  async logout(domainId: string, userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenService.revokeRefreshToken(
        domainId,
        userId,
        refreshToken,
      );
    } else {
      // Revogar todos os tokens do usuário
      await this.refreshTokenService.revokeAllUserTokens(domainId, userId);
    }
  }

  async verifyMfaChallenge(
    mfaToken: string,
    code: string,
    mfaType: MfaType = MfaType.TOTP,
  ): Promise<LoginResponseDto> {
    // Validar token temporário
    const payload = await this.jwtService.verifyToken(mfaToken);
    const domainId = payload.domain_id;
    const userId = payload.sub;

    // Verificar se token está no Redis
    const redisKey = `mfa_challenge:${domainId}:${userId}:${mfaToken}`;
    const redisClient = this.refreshTokenService['redisClient'];
    const stored = await redisClient.get(redisKey);

    if (!stored) {
      throw new UnauthorizedException('MFA token invalid or expired');
    }

    // Verificar código MFA
    const isValid = await this.mfaService.verifyMfa(domainId, userId, code, mfaType);
    if (!isValid) {
      throw new UnauthorizedException('MFA code invalid');
    }

    // Remover token temporário
    await redisClient.del(redisKey);

    // Buscar usuário e domínio
    const user = await this.userService.findByEmail(domainId, payload.email);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });

    // Atualizar último login
    await this.userService.updateLastLogin(domainId, userId);

    // Gerar tokens finais
    const accessToken = await this.jwtService.generateAccessToken(
      user,
      domain?.slug,
    );
    const refreshToken = await this.jwtService.generateRefreshToken(
      user,
      domain?.slug,
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
      mfa_required: false,
    };
  }
}

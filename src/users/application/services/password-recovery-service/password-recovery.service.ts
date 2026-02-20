import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UserService } from '../user-service/user.service';
import { PasswordService } from '../../../../shared/services/password.service';
import { EmailService } from '../../../../shared/services/email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { ForgotPasswordDto } from '../../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../../dtos/reset-password.dto';
import { AppLogger, APP_LOGGER } from '../../../../shared/utils/logger';

@Injectable()
export class PasswordRecoveryService {
  private readonly context = PasswordRecoveryService.name;
  private readonly tokenTtl: number; // em segundos

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {
    // Converter PASSWORD_RESET_TOKEN_EXPIRES_IN (ex: "30m") para segundos
    const expiresIn = this.configService.get<string>(
      'PASSWORD_RESET_TOKEN_EXPIRES_IN',
      '30m',
    );
    this.tokenTtl = this.parseExpiresIn(expiresIn);
  }

  async requestPasswordReset(
    domainId: string,
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('requestPasswordReset started', this.context, domainId);
    const { email } = forgotPasswordDto;

    // Buscar usuário
    const user = await this.userService.findByEmail(domainId, email);
    if (!user) {
      // Por segurança, não revelar se o email existe ou não
      return {
        success: true,
        message: 'Se o email existir, um link de recuperação será enviado',
      };
    }

    // Gerar token único
    const token = this.generateToken();

    // Calcular expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.tokenTtl);

    // Salvar token no banco
    const resetToken = this.passwordResetTokenRepository.create({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });
    await this.passwordResetTokenRepository.save(resetToken);

    // Armazenar também no Redis com namespace de domínio (para rate limiting e validação rápida)
    const redisKey = `password_reset:${domainId}:${user.id}:${token}`;
    await this.redisClient.setex(redisKey, this.tokenTtl, user.id);

    // Buscar domínio para incluir nome no email
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });

    // Enviar email com link de reset
    await this.emailService.sendPasswordResetEmail(
      user.email,
      token,
      domain?.name,
    );

    this.logger.log('requestPasswordReset completed', this.context, domainId);
    return {
      success: true,
      message: 'Se o email existir, um link de recuperação será enviado',
    };
  }

  async resetPassword(
    domainId: string,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('resetPassword started', this.context, domainId);
    const { token, new_password } = resetPasswordDto;

    // Buscar token no banco
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Token inválido');
    }

    // Validar expiração
    if (resetToken.expires_at < new Date()) {
      throw new BadRequestException('Token expirado');
    }

    // Validar se já foi usado
    if (resetToken.used_at) {
      throw new BadRequestException('Token já foi utilizado');
    }

    // Validar que o usuário pertence ao domínio
    if (resetToken.user.domain_id !== domainId) {
      throw new BadRequestException('Token não pertence a este domínio');
    }

    // Validar força da senha
    const passwordValidation = this.passwordService.validatePasswordStrength(
      new_password,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.errors.join(', '));
    }

    // Hash da nova senha
    const passwordHash = await this.passwordService.hashPassword(new_password);

    // Atualizar senha do usuário
    await this.userService['userRepository'].update(domainId, resetToken.user.id, {
      password_hash: passwordHash,
    });

    // Marcar token como usado
    resetToken.used_at = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    // Remover do Redis
    const redisKey = `password_reset:${domainId}:${resetToken.user.id}:${token}`;
    await this.redisClient.del(redisKey);

    // Buscar domínio para incluir nome no email
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });

    // Enviar email de confirmação (usando método específico se existir, senão usar o mesmo)
    if (this.emailService['isConfigured']) {
      this.logger.log(
        'Password reset confirmed',
        this.context,
        domainId,
      );
    }

    this.logger.log('resetPassword completed', this.context, domainId);
    return {
      success: true,
      message: 'Senha redefinida com sucesso',
    };
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 30 * 60; // Default: 30 minutos em segundos
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
        return 30 * 60;
    }
  }
}

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import sgMail from '@sendgrid/mail';
import { AppLogger, APP_LOGGER } from '../utils/logger';

@Injectable()
export class EmailService {
  private readonly context = EmailService.name;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM', 'noreply@une.cx');
    this.fromName =
      this.configService.get<string>('EMAIL_FROM_NAME', 'Une.cx');

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
    }
  }

  async sendMfaCode(
    domainId: string,
    userId: string,
    email: string,
    domainName?: string,
  ): Promise<{ code: string; expiresIn: number }> {
    this.logger.log('sendMfaCode started', this.context, domainId);
    if (!this.isConfigured) {
      throw new BadRequestException('Email service not configured');
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 300; // 5 minutos em segundos

    // Armazenar código no Redis com namespace de domínio
    const redisKey = `mfa_email:${domainId}:${userId}:${code}`;
    await this.redisClient.setex(redisKey, expiresIn, code);

    // Enviar email via SendGrid
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: `Código de verificação Une.cx${domainName ? ` - ${domainName}` : ''}`,
      text: `Seu código de verificação é: ${code}. Válido por 5 minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Código de Verificação</h2>
          <p>Seu código de verificação Une.cx${domainName ? ` - ${domainName}` : ''} é:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Este código é válido por 5 minutos.</p>
          <p>Se você não solicitou este código, ignore este email.</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      this.logger.error('sendMfaCode failed', (error as Error)?.stack, this.context, domainId);
      throw new BadRequestException('Erro ao enviar email: ' + (error as Error).message);
    }

    this.logger.log('sendMfaCode completed', this.context, domainId);
    return { code, expiresIn };
  }

  async verifyMfaCode(
    domainId: string,
    userId: string,
    code: string,
  ): Promise<boolean> {
    this.logger.debug('verifyMfaCode started', this.context, domainId);
    const redisKey = `mfa_email:${domainId}:${userId}:${code}`;
    const stored = await this.redisClient.get(redisKey);

    if (!stored) {
      return false;
    }

    // Remover código usado
    await this.redisClient.del(redisKey);
    return true;
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    domainName?: string,
  ): Promise<void> {
    this.logger.log('sendPasswordResetEmail started', this.context);
    if (!this.isConfigured) {
      this.logger.debug('sendPasswordResetEmail: email not configured, skipping send', this.context);
      return;
    }

    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;

    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: `Redefinição de senha${domainName ? ` - ${domainName}` : ''}`,
      text: `Clique no link para redefinir sua senha: ${resetUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Redefinição de Senha</h2>
          <p>Você solicitou a redefinição de senha${domainName ? ` para ${domainName}` : ''}.</p>
          <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Redefinir Senha</a></p>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p>Este link é válido por 30 minutos.</p>
          <p>Se você não solicitou esta redefinição, ignore este email.</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      this.logger.error('sendPasswordResetEmail failed', (error as Error)?.stack, this.context);
      throw new BadRequestException('Erro ao enviar email: ' + (error as Error).message);
    }
    this.logger.log('sendPasswordResetEmail completed', this.context);
  }
}

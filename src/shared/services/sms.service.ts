import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import twilio from 'twilio';

@Injectable()
export class SmsService {
  private readonly twilioClient: twilio.Twilio | null = null;
  private readonly twilioPhoneNumber: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber =
      this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    // Só inicializar Twilio se as credenciais estiverem configuradas corretamente
    if (accountSid && authToken && accountSid.startsWith('AC') && this.twilioPhoneNumber) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
      } catch (error) {
        console.warn('Twilio não configurado corretamente. SMS MFA não estará disponível.');
      }
    }
  }

  async sendMfaCode(
    domainId: string,
    userId: string,
    phoneNumber: string,
  ): Promise<{ code: string; expiresIn: number }> {
    if (!this.twilioClient) {
      throw new BadRequestException('SMS service não configurado');
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 300; // 5 minutos em segundos

    // Armazenar código no Redis com namespace de domínio
    const redisKey = `mfa_sms:${domainId}:${userId}:${code}`;
    await this.redisClient.setex(redisKey, expiresIn, code);

    // Enviar SMS via Twilio
    try {
      await this.twilioClient.messages.create({
        body: `Seu código de verificação Une.cx é: ${code}. Válido por 5 minutos.`,
        from: this.twilioPhoneNumber,
        to: phoneNumber,
      });
    } catch (error) {
      throw new BadRequestException('Erro ao enviar SMS: ' + error.message);
    }

    return { code, expiresIn };
  }

  async verifyMfaCode(
    domainId: string,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const redisKey = `mfa_sms:${domainId}:${userId}:${code}`;
    const stored = await this.redisClient.get(redisKey);

    if (!stored) {
      return false;
    }

    // Remover código usado
    await this.redisClient.del(redisKey);
    return true;
  }
}

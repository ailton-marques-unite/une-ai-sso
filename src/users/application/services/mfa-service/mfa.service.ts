import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes as cryptoRandomBytes } from 'crypto';
import { UserMfa, MfaType } from '../../../domain/entities/user-mfa.entity';
import { User } from '../../../domain/entities/user.entity';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { SmsService } from '../../../../shared/services/sms.service';
import { EmailService } from '../../../../shared/services/email.service';

export interface MfaSetupResponse {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

@Injectable()
export class MfaService {
  private readonly encryptionKey: Buffer;
  private readonly issuer: string;

  constructor(
    @InjectRepository(UserMfa)
    private readonly userMfaRepository: Repository<UserMfa>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {
    const key = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      throw new Error('MFA_ENCRYPTION_KEY deve ser uma chave hexadecimal de 64 caracteres (32 bytes)');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
    this.issuer = this.configService.get<string>('MFA_ISSUER', 'Une.cx');
  }

  async setupMfa(
    domainId: string,
    userId: string,
    mfaType: MfaType = MfaType.TOTP,
  ): Promise<MfaSetupResponse> {
    // Verificar se usuário existe e pertence ao domínio
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (mfaType === MfaType.TOTP) {
      return this.setupTotp(domainId, userId, user.email);
    }

    throw new BadRequestException(`Tipo MFA não suportado: ${mfaType}`);
  }

  private async setupTotp(
    domainId: string,
    userId: string,
    userEmail: string,
  ): Promise<MfaSetupResponse> {
    // Gerar secret TOTP
    const secret = speakeasy.generateSecret({
      name: `${this.issuer} (${userEmail})`,
      issuer: this.issuer,
      length: 32,
    });

    // Gerar QR Code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Gerar códigos de backup (10 códigos de 8 dígitos)
    const backupCodes = this.generateBackupCodesArray(10);

    // Criptografar secret e backup codes
    const encryptedSecret = this.encrypt(secret.base32);
    const encryptedBackupCodes = backupCodes.map((code) => this.encrypt(code));

    // Salvar no banco (mas não marcar como primary ainda - usuário precisa verificar primeiro)
    const userMfa = this.userMfaRepository.create({
      user_id: userId,
      mfa_type: MfaType.TOTP,
      secret: encryptedSecret,
      backup_codes: encryptedBackupCodes,
      is_primary: false,
    });

    await this.userMfaRepository.save(userMfa);

    return {
      secret: secret.base32, // Retornar não criptografado para o usuário configurar
      qr_code: qrCodeUrl,
      backup_codes: backupCodes, // Retornar não criptografados para o usuário salvar
    };
  }

  async verifyMfa(
    domainId: string,
    userId: string,
    code: string,
    mfaType: MfaType = MfaType.TOTP,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar SMS MFA
    if (mfaType === MfaType.SMS) {
      return this.smsService.verifyMfaCode(domainId, userId, code);
    }

    // Verificar Email MFA
    if (mfaType === MfaType.EMAIL) {
      return this.emailService.verifyMfaCode(domainId, userId, code);
    }

    // Verificar TOTP
    const userMfa = await this.userMfaRepository.findOne({
      where: { user_id: userId, mfa_type: mfaType, is_primary: true },
    });

    if (!userMfa) {
      throw new NotFoundException('MFA não configurado para este usuário');
    }

    // Descriptografar secret
    const secret = this.decrypt(userMfa.secret);

    // Verificar código TOTP
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2, // Permitir ±2 intervalos de tempo (60 segundos)
    });

    if (isValid) {
      return true;
    }

    // Se não for válido, verificar backup codes
    if (userMfa.backup_codes && userMfa.backup_codes.length > 0) {
      const decryptedBackupCodes = userMfa.backup_codes.map((encrypted) =>
        this.decrypt(encrypted),
      );

      const backupIndex = decryptedBackupCodes.indexOf(code);
      if (backupIndex !== -1) {
        // Remover código de backup usado
        userMfa.backup_codes.splice(backupIndex, 1);
        const encryptedBackupCodes = userMfa.backup_codes.map((bc) =>
          this.encrypt(bc),
        );
        userMfa.backup_codes = encryptedBackupCodes;
        await this.userMfaRepository.save(userMfa);
        return true;
      }
    }

    return false;
  }

  async sendMfaCode(
    domainId: string,
    userId: string,
    mfaType: MfaType,
  ): Promise<{ code: string; expiresIn: number }> {
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (mfaType === MfaType.SMS) {
      if (!user.phone) {
        throw new BadRequestException('Telefone não cadastrado');
      }
      return this.smsService.sendMfaCode(domainId, userId, user.phone);
    }

    if (mfaType === MfaType.EMAIL) {
      const domain = await this.domainRepository.findOne({
        where: { id: domainId },
      });
      return this.emailService.sendMfaCode(
        domainId,
        userId,
        user.email,
        domain?.name,
      );
    }

    throw new BadRequestException(`Tipo MFA não suporta envio de código: ${mfaType}`);
  }

  async enableMfa(
    domainId: string,
    userId: string,
    verificationCode: string,
    mfaType: MfaType = MfaType.TOTP,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const userMfa = await this.userMfaRepository.findOne({
      where: { user_id: userId, mfa_type: mfaType, is_primary: false },
      order: { created_at: 'DESC' },
    });

    if (!userMfa) {
      throw new NotFoundException('MFA não configurado. Execute setup primeiro.');
    }

    // Verificar código
    const isValid = await this.verifyMfa(domainId, userId, verificationCode, mfaType);
    if (!isValid) {
      throw new BadRequestException('Código de verificação inválido');
    }

    // Marcar como primary e desabilitar outros métodos MFA primários
    await this.userMfaRepository.update(
      { user_id: userId, is_primary: true },
      { is_primary: false },
    );

    userMfa.is_primary = true;
    await this.userMfaRepository.save(userMfa);

    // Atualizar flag no usuário
    await this.userRepository.update({ id: userId }, { mfa_enabled: true });
  }

  async disableMfa(domainId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Remover todos os métodos MFA
    await this.userMfaRepository.delete({ user_id: userId });

    // Atualizar flag no usuário
    await this.userRepository.update({ id: userId }, { mfa_enabled: false });
  }

  async generateBackupCodes(
    domainId: string,
    userId: string,
  ): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const userMfa = await this.userMfaRepository.findOne({
      where: { user_id: userId, is_primary: true },
    });

    if (!userMfa) {
      throw new NotFoundException('MFA não está habilitado');
    }

    const backupCodes = this.generateBackupCodesArray(10);
    const encryptedBackupCodes = backupCodes.map((code) => this.encrypt(code));

    userMfa.backup_codes = encryptedBackupCodes;
    await this.userMfaRepository.save(userMfa);

    return backupCodes;
  }

  private generateBackupCodesArray(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).readUInt32BE(0) % 100000000;
      codes.push(code.toString().padStart(8, '0'));
    }
    return codes;
  }

  private encrypt(text: string): string {
    const iv = cryptoRandomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(encrypted: string): string {
    const [ivHex, encryptedText] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

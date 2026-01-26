import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { MfaService, MfaSetupResponse } from '../mfa-service/mfa.service';
import { UserMfa, MfaType } from '../../../domain/entities/user-mfa.entity';
import { User } from '../../../domain/entities/user.entity';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { SmsService } from '../../../../shared/services/sms.service';
import { EmailService } from '../../../../shared/services/email.service';

// Mock external libraries
const mockGenerateSecret = jest.fn();
const mockTotpVerify = jest.fn();

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

describe('MfaService', () => {
  let service: MfaService;
  let userMfaRepository: jest.Mocked<Repository<UserMfa>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let domainRepository: jest.Mocked<Repository<Domain>>;
  let redisClient: jest.Mocked<Redis>;
  let configService: jest.Mocked<ConfigService>;
  let smsService: jest.Mocked<SmsService>;
  let emailService: jest.Mocked<EmailService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'test@example.com';
  const mockPhone = '+5511999999999';
  const mockMfaId = 'mfa-uuid';
  const mockVerificationCode = '123456';
  const mockBackupCode = '12345678';
  const mockSmsCode = '654321';
  const mockEmailCode = '987654';

  // Valid encryption key (64 hex characters = 32 bytes)
  // Using a valid hex string: 32 bytes = 64 hex characters
  const mockEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: mockEmail,
    phone: mockPhone,
    is_active: true,
    mfa_enabled: false,
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  const mockDomain: Domain = {
    id: mockDomainId,
    name: 'Test Domain',
    slug: 'test-domain',
    is_active: true,
    created_by: 'admin-uuid',
    created_at: new Date(),
    updated_at: new Date(),
  } as Domain;

  const mockUserMfa: UserMfa = {
    id: mockMfaId,
    user_id: mockUserId,
    mfa_type: MfaType.TOTP,
    secret: 'encrypted-secret',
    backup_codes: ['encrypted-code1', 'encrypted-code2'],
    is_primary: false,
    created_at: new Date(),
  } as UserMfa;

  const mockSpeakeasySecret = {
    base32: 'JBSWY3DPEHPK3PXP',
    otpauth_url: 'otpauth://totp/Une.cx%20(test@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Une.cx',
  };

  const mockQrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeEach(async () => {
    // Mock speakeasy
    (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSpeakeasySecret);
    (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

    // Mock QRCode
    (QRCode.toDataURL as jest.Mock).mockResolvedValue(mockQrCodeDataUrl);

    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        {
          provide: getRepositoryToken(UserMfa),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: redisClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'MFA_ENCRYPTION_KEY') {
                return mockEncryptionKey;
              }
              if (key === 'MFA_ISSUER') {
                return defaultValue || 'Une.cx';
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendMfaCode: jest.fn(),
            verifyMfaCode: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendMfaCode: jest.fn(),
            verifyMfaCode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    userMfaRepository = module.get(getRepositoryToken(UserMfa));
    userRepository = module.get(getRepositoryToken(User));
    domainRepository = module.get(getRepositoryToken(Domain));
    redisClient = module.get('REDIS_CLIENT');
    configService = module.get(ConfigService);
    smsService = module.get(SmsService);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('setupMfa', () => {
    it('should setup TOTP MFA when user exists and type is TOTP', async () => {
      // Arrange
      const mockBackupCodes = ['12345678', '87654321', '11111111', '22222222', '33333333', '44444444', '55555555', '66666666', '77777777', '88888888'];
      const mockCreatedUserMfa = { ...mockUserMfa, id: mockMfaId };

      userRepository.findOne.mockResolvedValue(mockUser);
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSpeakeasySecret);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(mockQrCodeDataUrl);
      userMfaRepository.create.mockReturnValue(mockCreatedUserMfa);
      userMfaRepository.save.mockResolvedValue(mockCreatedUserMfa);

      // Act
      const result = await service.setupMfa(mockDomainId, mockUserId, MfaType.TOTP);

      // Assert
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qr_code');
      expect(result).toHaveProperty('backup_codes');
      expect(result.secret).toBe(mockSpeakeasySecret.base32);
      expect(result.qr_code).toBe(mockQrCodeDataUrl);
      expect(result.backup_codes).toHaveLength(10);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: `Une.cx (${mockEmail})`,
        issuer: 'Une.cx',
        length: 32,
      });
      expect(QRCode.toDataURL).toHaveBeenCalledWith(mockSpeakeasySecret.otpauth_url);
      expect(userMfaRepository.create).toHaveBeenCalled();
      expect(userMfaRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.setupMfa(mockDomainId, mockUserId, MfaType.TOTP),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.setupMfa(mockDomainId, mockUserId, MfaType.TOTP),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.setupMfa(mockDomainId, mockUserId, MfaType.TOTP),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.setupMfa(mockDomainId, mockUserId, MfaType.TOTP),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
    });

    it('should throw BadRequestException when MFA type is not supported', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.setupMfa(mockDomainId, mockUserId, 'unsupported' as MfaType),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setupMfa(mockDomainId, mockUserId, 'unsupported' as MfaType),
      ).rejects.toThrow('MFA type not supported: unsupported');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
    });
  });

  describe('verifyMfa', () => {
    it('should verify valid TOTP code successfully', async () => {
      // Arrange
      const decryptedSecret = 'JBSWY3DPEHPK3PXP';
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(mockUserMfa);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      // Mock decrypt to return the secret
      const decryptSpy = jest.spyOn(service as any, 'decrypt').mockReturnValue(decryptedSecret);

      // Act
      const result = await service.verifyMfa(
        mockDomainId,
        mockUserId,
        mockVerificationCode,
        MfaType.TOTP,
      );

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, mfa_type: MfaType.TOTP, is_primary: true },
      });
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: decryptedSecret,
        encoding: 'base32',
        token: mockVerificationCode,
        window: 2,
      });

      decryptSpy.mockRestore();
    });

    it('should verify valid backup code and remove it from array', async () => {
      // Arrange
      const decryptedSecret = 'JBSWY3DPEHPK3PXP';
      const decryptedBackupCodes = [mockBackupCode, '87654321'];
      const userMfaWithBackupCodes = {
        ...mockUserMfa,
        backup_codes: ['encrypted-code1', 'encrypted-code2'],
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(userMfaWithBackupCodes);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      // Mock decrypt
      const decryptSpy = jest.spyOn(service as any, 'decrypt');
      decryptSpy.mockImplementation((encrypted: string) => {
        if (encrypted === 'encrypted-secret') return decryptedSecret;
        if (encrypted === 'encrypted-code1') return mockBackupCode;
        if (encrypted === 'encrypted-code2') return '87654321';
        return encrypted;
      });

      // Mock encrypt for re-encrypting remaining backup codes
      const encryptSpy = jest.spyOn(service as any, 'encrypt').mockReturnValue('encrypted-remaining');

      userMfaRepository.save.mockResolvedValue(userMfaWithBackupCodes);

      // Act
      const result = await service.verifyMfa(
        mockDomainId,
        mockUserId,
        mockBackupCode,
        MfaType.TOTP,
      );

      // Assert
      expect(result).toBe(true);
      expect(userMfaRepository.save).toHaveBeenCalled();
      const savedCall = userMfaRepository.save.mock.calls[0][0];
      expect(savedCall.backup_codes).toHaveLength(1);

      decryptSpy.mockRestore();
      encryptSpy.mockRestore();
    });

    it('should verify SMS code successfully', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      smsService.verifyMfaCode.mockResolvedValue(true);

      // Act
      const result = await service.verifyMfa(
        mockDomainId,
        mockUserId,
        mockSmsCode,
        MfaType.SMS,
      );

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(smsService.verifyMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockSmsCode,
      );
      expect(userMfaRepository.findOne).not.toHaveBeenCalled();
    });

    it('should verify Email code successfully', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      emailService.verifyMfaCode.mockResolvedValue(true);

      // Act
      const result = await service.verifyMfa(
        mockDomainId,
        mockUserId,
        mockEmailCode,
        MfaType.EMAIL,
      );

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(emailService.verifyMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockEmailCode,
      );
      expect(userMfaRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verifyMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.verifyMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
    });

    it('should throw NotFoundException when MFA is not configured', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verifyMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.verifyMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow('MFA not configured for this user');

      expect(userMfaRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, mfa_type: MfaType.TOTP, is_primary: true },
      });
    });

    it('should return false when TOTP code is invalid', async () => {
      // Arrange
      const decryptedSecret = 'JBSWY3DPEHPK3PXP';
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(mockUserMfa);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      const decryptSpy = jest.spyOn(service as any, 'decrypt').mockReturnValue(decryptedSecret);

      // Mock empty backup codes
      const userMfaNoBackup = { ...mockUserMfa, backup_codes: [] };
      userMfaRepository.findOne.mockResolvedValue(userMfaNoBackup);

      // Act
      const result = await service.verifyMfa(
        mockDomainId,
        mockUserId,
        'invalid-code',
        MfaType.TOTP,
      );

      // Assert
      expect(result).toBe(false);
      expect(speakeasy.totp.verify).toHaveBeenCalled();

      decryptSpy.mockRestore();
    });

    it('should return false when backup code is invalid', async () => {
      // Arrange
      const decryptedSecret = 'JBSWY3DPEHPK3PXP';
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(mockUserMfa);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      const decryptSpy = jest.spyOn(service as any, 'decrypt');
      decryptSpy.mockImplementation((encrypted: string) => {
        if (encrypted === 'encrypted-secret') return decryptedSecret;
        if (encrypted === 'encrypted-code1') return '11111111';
        if (encrypted === 'encrypted-code2') return '22222222';
        return encrypted;
      });

      // Act
      const result = await service.verifyMfa(
        mockDomainId,
        mockUserId,
        'invalid-backup-code',
        MfaType.TOTP,
      );

      // Assert
      expect(result).toBe(false);
      expect(userMfaRepository.save).not.toHaveBeenCalled();

      decryptSpy.mockRestore();
    });
  });

  describe('sendMfaCode', () => {
    it('should send SMS code when type is SMS and phone is registered', async () => {
      // Arrange
      const mockSmsResponse = { code: mockSmsCode, expiresIn: 300 };
      userRepository.findOne.mockResolvedValue(mockUser);
      smsService.sendMfaCode.mockResolvedValue(mockSmsResponse);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, MfaType.SMS);

      // Assert
      expect(result).toEqual(mockSmsResponse);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(smsService.sendMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockPhone,
      );
    });

    it('should send Email code when type is EMAIL', async () => {
      // Arrange
      const mockEmailResponse = { code: mockEmailCode, expiresIn: 300 };
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      emailService.sendMfaCode.mockResolvedValue(mockEmailResponse);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, MfaType.EMAIL);

      // Assert
      expect(result).toEqual(mockEmailResponse);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(emailService.sendMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockEmail,
        mockDomain.name,
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, MfaType.SMS),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, MfaType.SMS),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(smsService.sendMfaCode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when type is SMS but phone is not registered', async () => {
      // Arrange
      const userWithoutPhone = { ...mockUser, phone: null };
      userRepository.findOne.mockResolvedValue(userWithoutPhone);

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, MfaType.SMS),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, MfaType.SMS),
      ).rejects.toThrow('Phone not registered');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(smsService.sendMfaCode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when MFA type does not support sending code', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, MfaType.TOTP),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, MfaType.TOTP),
      ).rejects.toThrow('MFA type does not support sending code: totp');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
    });
  });

  describe('enableMfa', () => {
    it('should enable MFA when verification code is valid', async () => {
      // Arrange
      const userMfaNotPrimary = { ...mockUserMfa, is_primary: false };
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(userMfaNotPrimary);
      userMfaRepository.update.mockResolvedValue(undefined as any);
      userMfaRepository.save.mockResolvedValue({ ...userMfaNotPrimary, is_primary: true });
      userRepository.update.mockResolvedValue(undefined as any);

      // Mock verifyMfa to return true
      const verifyMfaSpy = jest.spyOn(service, 'verifyMfa').mockResolvedValue(true);

      // Act
      await service.enableMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, mfa_type: MfaType.TOTP, is_primary: false },
        order: { created_at: 'DESC' },
      });
      expect(verifyMfaSpy).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockVerificationCode,
        MfaType.TOTP,
      );
      expect(userMfaRepository.update).toHaveBeenCalledWith(
        { user_id: mockUserId, is_primary: true },
        { is_primary: false },
      );
      expect(userMfaRepository.save).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockUserId },
        { mfa_enabled: true },
      );

      verifyMfaSpy.mockRestore();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.enableMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.enableMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when MFA is not configured', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.enableMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.enableMfa(mockDomainId, mockUserId, mockVerificationCode, MfaType.TOTP),
      ).rejects.toThrow('MFA not configured. Execute setup first.');

      expect(userMfaRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, mfa_type: MfaType.TOTP, is_primary: false },
        order: { created_at: 'DESC' },
      });
    });

    it('should throw BadRequestException when verification code is invalid', async () => {
      // Arrange
      const userMfaNotPrimary = { ...mockUserMfa, is_primary: false };
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(userMfaNotPrimary);

      // Mock verifyMfa to return false
      const verifyMfaSpy = jest.spyOn(service, 'verifyMfa').mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.enableMfa(mockDomainId, mockUserId, 'invalid-code', MfaType.TOTP),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.enableMfa(mockDomainId, mockUserId, 'invalid-code', MfaType.TOTP),
      ).rejects.toThrow('Verification code invalid');

      expect(verifyMfaSpy).toHaveBeenCalled();
      expect(userMfaRepository.update).not.toHaveBeenCalled();

      verifyMfaSpy.mockRestore();
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA when user exists', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.delete.mockResolvedValue(undefined as any);
      userRepository.update.mockResolvedValue(undefined as any);

      // Act
      await service.disableMfa(mockDomainId, mockUserId);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.delete).toHaveBeenCalledWith({ user_id: mockUserId });
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockUserId },
        { mfa_enabled: false },
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.disableMfa(mockDomainId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.disableMfa(mockDomainId, mockUserId)).rejects.toThrow(
        'User not found',
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate new backup codes when MFA is enabled', async () => {
      // Arrange
      const userMfaPrimary = { ...mockUserMfa, is_primary: true };
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(userMfaPrimary);
      userMfaRepository.save.mockResolvedValue(userMfaPrimary);

      // Act
      const result = await service.generateBackupCodes(mockDomainId, mockUserId);

      // Assert
      expect(result).toHaveLength(10);
      expect(Array.isArray(result)).toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, is_primary: true },
      });
      expect(userMfaRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.generateBackupCodes(mockDomainId, mockUserId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.generateBackupCodes(mockDomainId, mockUserId),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(userMfaRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when MFA is not enabled', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      userMfaRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.generateBackupCodes(mockDomainId, mockUserId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.generateBackupCodes(mockDomainId, mockUserId),
      ).rejects.toThrow('MFA is not enabled');

      expect(userMfaRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, is_primary: true },
      });
      expect(userMfaRepository.save).not.toHaveBeenCalled();
    });
  });
});

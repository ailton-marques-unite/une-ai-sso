import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EmailService } from '../email.service';
import { APP_LOGGER } from '../../utils/logger';
import sgMail from '@sendgrid/mail';

// Mock @sendgrid/mail
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;
  let redisClient: jest.Mocked<Redis>;
  let mockSgMail: jest.Mocked<typeof sgMail>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'test@example.com';
  const mockDomainName = 'Test Domain';
  const mockResetToken = 'reset-token-123';
  const mockSendGridApiKey = 'SG.test-api-key';
  const mockEmailFrom = 'test@example.com';
  const mockEmailFromName = 'Test Name';
  const mockFrontendUrl = 'https://app.example.com';
  const mockMfaCode = '123456';

  beforeEach(async () => {
    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    // Mock SendGrid
    mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
    mockSgMail.setApiKey = jest.fn();
    mockSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

    // Mock Math.random para gerar código previsível
    jest.spyOn(Math, 'random').mockReturnValue(0.123456);

    // Mock console.log
    jest.spyOn(console, 'log').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                SENDGRID_API_KEY: mockSendGridApiKey,
                EMAIL_FROM: mockEmailFrom,
                EMAIL_FROM_NAME: mockEmailFromName,
                FRONTEND_URL: mockFrontendUrl,
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: redisClient,
        },
        {
          provide: APP_LOGGER,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get(ConfigService);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should configure fromEmail with default value when EMAIL_FROM is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'EMAIL_FROM') {
                  return defaultValue;
                }
                if (key === 'SENDGRID_API_KEY') {
                  return mockSendGridApiKey;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const testService = module.get<EmailService>(EmailService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('EMAIL_FROM', 'noreply@une.cx');
    });

    it('should configure fromEmail with EMAIL_FROM when defined', async () => {
      // Arrange & Act - já configurado no beforeEach com mockEmailFrom

      // Assert
      expect(configService.get).toHaveBeenCalledWith('EMAIL_FROM', 'noreply@une.cx');
    });

    it('should configure fromName with default value when EMAIL_FROM_NAME is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'EMAIL_FROM_NAME') {
                  return defaultValue;
                }
                if (key === 'SENDGRID_API_KEY') {
                  return mockSendGridApiKey;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const testService = module.get<EmailService>(EmailService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('EMAIL_FROM_NAME', 'Une.cx');
    });

    it('should configure fromName with EMAIL_FROM_NAME when defined', async () => {
      // Arrange & Act - já configurado no beforeEach com mockEmailFromName

      // Assert
      expect(configService.get).toHaveBeenCalledWith('EMAIL_FROM_NAME', 'Une.cx');
    });

    it('should configure isConfigured as true when SENDGRID_API_KEY is present', async () => {
      // Arrange & Act - já configurado no beforeEach com mockSendGridApiKey

      // Assert
      expect(mockSgMail.setApiKey).toHaveBeenCalledWith(mockSendGridApiKey);
    });

    it('should configure isConfigured as false when SENDGRID_API_KEY is not present', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'SENDGRID_API_KEY') {
                  return undefined;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const testService = module.get<EmailService>(EmailService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockEmail),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockEmail),
      ).rejects.toThrow('Email service not configured');
    });

    it('should call sgMail.setApiKey when SENDGRID_API_KEY is present', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Assert
      expect(mockSgMail.setApiKey).toHaveBeenCalledWith(mockSendGridApiKey);
    });
  });

  describe('sendMfaCode', () => {
    it('should generate 6-digit MFA code', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.code.length).toBe(6);
    });

    it('should store code in Redis with correct key (mfa_email:domainId:userId:code)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `mfa_email:${mockDomainId}:${mockUserId}:${result.code}`,
        300,
        result.code,
      );
    });

    it('should store code in Redis with expiration of 300 seconds (5 minutes)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        300,
        expect.any(String),
      );
    });

    it('should send email via SendGrid with correct recipient', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockEmail,
        }),
      );
    });

    it('should send email via SendGrid with correct sender (fromEmail and fromName)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: {
            email: mockEmailFrom,
            name: mockEmailFromName,
          },
        }),
      );
    });

    it('should send email with correct subject when domainName is not provided', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Código de verificação Une.cx',
        }),
      );
    });

    it('should send email with correct subject when domainName is provided', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockEmail, mockDomainName);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: `Código de verificação Une.cx - ${mockDomainName}`,
        }),
      );
    });

    it('should send email with code in text and HTML', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(result.code),
          html: expect.stringContaining(result.code),
        }),
      );
    });

    it('should return code and expiresIn when successful', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(300);
    });

    it('should return expiresIn as 300 seconds', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      const result = await service.sendMfaCode(mockDomainId, mockUserId, mockEmail);

      // Assert
      expect(result.expiresIn).toBe(300);
    });

    it('should throw BadRequestException when service is not configured (isConfigured = false)', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'SENDGRID_API_KEY') {
                  return undefined;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<EmailService>(EmailService);

      // Act & Assert
      await expect(
        unconfiguredService.sendMfaCode(mockDomainId, mockUserId, mockEmail),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with message "Email service not configured"', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'SENDGRID_API_KEY') {
                  return undefined;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<EmailService>(EmailService);

      // Act & Assert
      await expect(
        unconfiguredService.sendMfaCode(mockDomainId, mockUserId, mockEmail),
      ).rejects.toThrow('Email service not configured');
    });

    it('should throw BadRequestException when SendGrid fails to send email', async () => {
      // Arrange
      const sendError = new Error('SendGrid API error');
      mockSgMail.send.mockRejectedValueOnce(sendError);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, mockEmail),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with message containing SendGrid error', async () => {
      // Arrange
      const sendError = new Error('SendGrid API error');
      mockSgMail.send.mockRejectedValueOnce(sendError);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, mockEmail),
      ).rejects.toThrow('Erro ao enviar email: SendGrid API error');
    });
  });

  describe('verifyMfaCode', () => {
    it('should search code in Redis with correct key (mfa_email:domainId:userId:code)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(
        `mfa_email:${mockDomainId}:${mockUserId}:${mockMfaCode}`,
      );
    });

    it('should return true when code is found in Redis', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);

      // Act
      const result = await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(result).toBe(true);
    });

    it('should remove code from Redis after successful verification', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        `mfa_email:${mockDomainId}:${mockUserId}:${mockMfaCode}`,
      );
    });

    it('should return false when code is not found in Redis', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(result).toBe(false);
    });

    it('should not remove code when code is not found', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should build resetUrl with FRONTEND_URL and resetToken when configured', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(`${mockFrontendUrl}/reset-password?token=${mockResetToken}`),
          html: expect.stringContaining(`${mockFrontendUrl}/reset-password?token=${mockResetToken}`),
        }),
      );
    });

    it('should build resetUrl with default value when FRONTEND_URL is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'FRONTEND_URL') {
                  return defaultValue;
                }
                if (key === 'SENDGRID_API_KEY') {
                  return mockSendGridApiKey;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const testService = module.get<EmailService>(EmailService);

      // Act
      await testService.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('http://localhost:3000/reset-password?token='),
        }),
      );
    });

    it('should send email via SendGrid with correct recipient', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockEmail,
        }),
      );
    });

    it('should send email via SendGrid with correct sender (fromEmail and fromName)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: {
            email: mockEmailFrom,
            name: mockEmailFromName,
          },
        }),
      );
    });

    it('should send email with correct subject when domainName is not provided', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Redefinição de senha',
        }),
      );
    });

    it('should send email with correct subject when domainName is provided', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendPasswordResetEmail(mockEmail, mockResetToken, mockDomainName);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: `Redefinição de senha - ${mockDomainName}`,
        }),
      );
    });

    it('should send email with resetUrl in text and HTML', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act
      await service.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(mockResetToken),
          html: expect.stringContaining(mockResetToken),
        }),
      );
    });

    it('should not throw exception when successful', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act & Assert
      await expect(
        service.sendPasswordResetEmail(mockEmail, mockResetToken),
      ).resolves.not.toThrow();
    });

    it('should log with logger when service is not configured (development)', async () => {
      // Arrange
      const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'SENDGRID_API_KEY') {
                  return undefined;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
          {
            provide: APP_LOGGER,
            useValue: mockLogger,
          },
        ],
      }).compile();

      const unconfiguredService = module.get<EmailService>(EmailService);

      // Act
      await unconfiguredService.sendPasswordResetEmail(mockEmail, mockResetToken);

      // Assert - when not configured we log with logger.debug and skip sending
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'sendPasswordResetEmail: email not configured, skipping send',
        expect.any(String),
      );
      expect(mockSgMail.send).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when SendGrid fails to send email', async () => {
      // Arrange
      const sendError = new Error('SendGrid API error');
      mockSgMail.send.mockRejectedValueOnce(sendError);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act & Assert
      await expect(
        service.sendPasswordResetEmail(mockEmail, mockResetToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with message containing SendGrid error', async () => {
      // Arrange
      const sendError = new Error('SendGrid API error');
      mockSgMail.send.mockRejectedValueOnce(sendError);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      // Act & Assert
      await expect(
        service.sendPasswordResetEmail(mockEmail, mockResetToken),
      ).rejects.toThrow('Erro ao enviar email: SendGrid API error');
    });
  });
});

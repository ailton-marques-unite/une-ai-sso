import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { SmsService } from '../sms.service';
import twilio from 'twilio';

// Mock twilio module
const mockTwilioClient = {
  messages: {
    create: jest.fn().mockResolvedValue({ sid: 'SM1234567890abcdef' }),
  },
};

jest.mock('twilio', () => jest.fn(() => mockTwilioClient));

describe('SmsService', () => {
  let service: SmsService;
  let configService: jest.Mocked<ConfigService>;
  let redisClient: jest.Mocked<Redis>;
  let mockTwilio: jest.MockedFunction<typeof twilio>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockPhoneNumber = '+5511999999999';
  const mockMfaCode = '123456';
  const mockAccountSid = 'AC1234567890abcdef';
  const mockAuthToken = 'auth-token-123';
  const mockPhoneNumberConfig = '+15551234567';
  const expiresIn = 300; // 5 minutos em segundos

  beforeEach(async () => {
    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    // Mock Twilio
    mockTwilio = twilio as jest.MockedFunction<typeof twilio>;
    mockTwilio.mockReturnValue(mockTwilioClient as any);
    mockTwilioClient.messages.create.mockResolvedValue({
      sid: 'SM1234567890abcdef',
    } as any);

    // Mock Math.random para gerar código previsível
    // Math.random() = 0.123456 -> código = 100000 + 0.123456 * 900000 = 211110.4 -> 211110
    jest.spyOn(Math, 'random').mockReturnValue(0.123456);

    // Mock console.warn
    jest.spyOn(console, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                TWILIO_ACCOUNT_SID: mockAccountSid,
                TWILIO_AUTH_TOKEN: mockAuthToken,
                TWILIO_PHONE_NUMBER: mockPhoneNumberConfig,
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: redisClient,
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    configService = module.get(ConfigService);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should initialize Twilio client when credentials are properly configured', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Assert
      expect(mockTwilio).toHaveBeenCalledWith(mockAccountSid, mockAuthToken);
      expect(configService.get).toHaveBeenCalledWith('TWILIO_ACCOUNT_SID');
      expect(configService.get).toHaveBeenCalledWith('TWILIO_AUTH_TOKEN');
      expect(configService.get).toHaveBeenCalledWith('TWILIO_PHONE_NUMBER');
    });

    it('should configure twilioPhoneNumber with TWILIO_PHONE_NUMBER from ConfigService', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Act - tentar enviar código (vai usar o phoneNumber configurado)
      await service.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber);

      // Assert
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from: mockPhoneNumberConfig,
        }),
      );
    });

    it('should call twilio() with correct accountSid and authToken when credentials are valid', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Assert
      expect(mockTwilio).toHaveBeenCalledWith(mockAccountSid, mockAuthToken);
    });

    it('should not initialize Twilio client when accountSid is missing', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'TWILIO_ACCOUNT_SID') {
                  return undefined;
                }
                if (key === 'TWILIO_AUTH_TOKEN') {
                  return mockAuthToken;
                }
                if (key === 'TWILIO_PHONE_NUMBER') {
                  return mockPhoneNumberConfig;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow('SMS service not configured');
    });

    it('should not initialize Twilio client when authToken is missing', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'TWILIO_ACCOUNT_SID') {
                  return mockAccountSid;
                }
                if (key === 'TWILIO_AUTH_TOKEN') {
                  return undefined;
                }
                if (key === 'TWILIO_PHONE_NUMBER') {
                  return mockPhoneNumberConfig;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow('SMS service not configured');
    });

    it('should not initialize Twilio client when accountSid does not start with AC', async () => {
      // Arrange
      const invalidAccountSid = 'INVALID123';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'TWILIO_ACCOUNT_SID') {
                  return invalidAccountSid;
                }
                if (key === 'TWILIO_AUTH_TOKEN') {
                  return mockAuthToken;
                }
                if (key === 'TWILIO_PHONE_NUMBER') {
                  return mockPhoneNumberConfig;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow('SMS service not configured');
    });

    it('should not initialize Twilio client when phoneNumber is missing', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'TWILIO_ACCOUNT_SID') {
                  return mockAccountSid;
                }
                if (key === 'TWILIO_AUTH_TOKEN') {
                  return mockAuthToken;
                }
                if (key === 'TWILIO_PHONE_NUMBER') {
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
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow('SMS service not configured');
    });

    it('should log warning when error occurs during Twilio initialization', async () => {
      // Arrange
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockTwilio.mockImplementationOnce(() => {
        throw new Error('Twilio initialization error');
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const config: Record<string, string> = {
                  TWILIO_ACCOUNT_SID: mockAccountSid,
                  TWILIO_AUTH_TOKEN: mockAuthToken,
                  TWILIO_PHONE_NUMBER: mockPhoneNumberConfig,
                };
                return config[key] || defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Twilio não configurado corretamente. SMS MFA não estará disponível.',
      );

      // Act & Assert - serviço não deve estar configurado
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);

      consoleWarnSpy.mockRestore();
    });

    it('should not initialize Twilio client when phoneNumber is empty string', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'TWILIO_ACCOUNT_SID') {
                  return mockAccountSid;
                }
                if (key === 'TWILIO_AUTH_TOKEN') {
                  return mockAuthToken;
                }
                if (key === 'TWILIO_PHONE_NUMBER') {
                  return '';
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow('SMS service not configured');
    });
  });

  describe('sendMfaCode', () => {
    it('should generate 6-digit code (100000-999999)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(result.code).toMatch(/^\d{6}$/);
      expect(parseInt(result.code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(result.code, 10)).toBeLessThanOrEqual(999999);
    });

    it('should store code in Redis with correct key (mfa_sms:domainId:userId:code)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `mfa_sms:${mockDomainId}:${mockUserId}:${result.code}`,
        expiresIn,
        result.code,
      );
    });

    it('should store code in Redis with correct TTL (300 seconds = 5 minutes)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expiresIn,
        expect.any(String),
      );
    });

    it('should store code as value in Redis', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        result.code,
      );
    });

    it('should send SMS via Twilio with correct message (including code and Portuguese text)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `Seu código de verificação Une.cx é: ${result.code}. Válido por 5 minutos.`,
        from: mockPhoneNumberConfig,
        to: mockPhoneNumber,
      });
    });

    it('should send SMS via Twilio with correct from (twilioPhoneNumber)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber);

      // Assert
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from: mockPhoneNumberConfig,
        }),
      );
    });

    it('should send SMS via Twilio with correct to (phoneNumber)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      await service.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber);

      // Assert
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockPhoneNumber,
        }),
      );
    });

    it('should return object with code and expiresIn (300)', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(result).toEqual({
        code: expect.any(String),
        expiresIn: expiresIn,
      });
      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('should call redisClient.setex with correct parameters', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `mfa_sms:${mockDomainId}:${mockUserId}:${result.code}`,
        expiresIn,
        result.code,
      );
    });

    it('should call twilioClient.messages.create with correct parameters', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
      } as any);

      // Act
      const result = await service.sendMfaCode(
        mockDomainId,
        mockUserId,
        mockPhoneNumber,
      );

      // Assert
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `Seu código de verificação Une.cx é: ${result.code}. Válido por 5 minutos.`,
        from: mockPhoneNumberConfig,
        to: mockPhoneNumber,
      });
    });

    it('should throw BadRequestException when Twilio client is not configured', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                // Retornar undefined para não inicializar Twilio
                return undefined;
              }),
            },
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: redisClient,
          },
        ],
      }).compile();

      const testService = module.get<SmsService>(SmsService);

      // Act & Assert
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(BadRequestException);
      await expect(
        testService.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow('SMS service not configured');
    });

    it('should throw BadRequestException when Twilio.messages.create fails', async () => {
      // Arrange
      const twilioError = new Error('Twilio API error');
      mockTwilioClient.messages.create.mockRejectedValueOnce(twilioError);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(new BadRequestException('Erro ao enviar SMS: Twilio API error'));
    });

    it('should include Twilio error message in exception', async () => {
      // Arrange
      const twilioError = new Error('Invalid phone number');
      mockTwilioClient.messages.create.mockRejectedValueOnce(twilioError);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);
      redisClient.setex.mockResolvedValue('OK');

      // Act & Assert
      await expect(
        service.sendMfaCode(mockDomainId, mockUserId, mockPhoneNumber),
      ).rejects.toThrow(new BadRequestException('Erro ao enviar SMS: Invalid phone number'));
    });
  });

  describe('verifyMfaCode', () => {
    it('should search code in Redis with correct key (mfa_sms:domainId:userId:code)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(
        `mfa_sms:${mockDomainId}:${mockUserId}:${mockMfaCode}`,
      );
    });

    it('should return true when code is found in Redis', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);
      redisClient.del.mockResolvedValue(1);

      // Act
      const result = await service.verifyMfaCode(
        mockDomainId,
        mockUserId,
        mockMfaCode,
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should remove code from Redis after successful verification', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);
      redisClient.del.mockResolvedValue(1);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        `mfa_sms:${mockDomainId}:${mockUserId}:${mockMfaCode}`,
      );
    });

    it('should call redisClient.get with correct key', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(
        `mfa_sms:${mockDomainId}:${mockUserId}:${mockMfaCode}`,
      );
    });

    it('should call redisClient.del with correct key when code found', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockMfaCode);
      redisClient.del.mockResolvedValue(1);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        `mfa_sms:${mockDomainId}:${mockUserId}:${mockMfaCode}`,
      );
    });

    it('should return false when code is not found in Redis', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.verifyMfaCode(
        mockDomainId,
        mockUserId,
        mockMfaCode,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should not call redisClient.del when code not found', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act
      await service.verifyMfaCode(mockDomainId, mockUserId, mockMfaCode);

      // Assert
      expect(redisClient.del).not.toHaveBeenCalled();
    });
  });
});

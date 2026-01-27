import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RefreshTokenService } from '../refresh-token.service';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let configService: jest.Mocked<ConfigService>;
  let redisClient: jest.Mocked<Redis>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockRefreshToken = 'refresh-token-string';
  const mockJwtRefreshTokenExpiresIn = '7d';
  const defaultRefreshTokenTtl = 7 * 24 * 60 * 60; // 7 dias em segundos

  beforeEach(async () => {
    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                return mockJwtRefreshTokenExpiresIn;
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

    service = module.get<RefreshTokenService>(RefreshTokenService);
    configService = module.get(ConfigService);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should configure refreshTokenTtl with JWT_REFRESH_TOKEN_EXPIRES_IN from ConfigService when defined', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Act
      await service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(configService.get).toHaveBeenCalledWith(
        'JWT_REFRESH_TOKEN_EXPIRES_IN',
        '7d',
      );
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });

    it('should configure refreshTokenTtl with default value when JWT_REFRESH_TOKEN_EXPIRES_IN is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return defaultValue;
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });

    it('should call parseExpiresIn with value from ConfigService', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Act
      await service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(configService.get).toHaveBeenCalledWith(
        'JWT_REFRESH_TOKEN_EXPIRES_IN',
        '7d',
      );
    });
  });

  describe('parseExpiresIn', () => {
    it('should convert "7d" to seconds (7 * 24 * 60 * 60)', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return '7d';
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);
      const expectedTtl = 7 * 24 * 60 * 60;

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expectedTtl,
        mockUserId,
      );
    });

    it('should convert "1h" to seconds (1 * 60 * 60)', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return '1h';
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);
      const expectedTtl = 1 * 60 * 60;

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expectedTtl,
        mockUserId,
      );
    });

    it('should convert "30m" to seconds (30 * 60)', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return '30m';
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);
      const expectedTtl = 30 * 60;

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expectedTtl,
        mockUserId,
      );
    });

    it('should convert "60s" to seconds (60)', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return '60s';
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);
      const expectedTtl = 60;

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expectedTtl,
        mockUserId,
      );
    });

    it('should use default value (7 days) when format is invalid', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return 'invalid-format';
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });

    it('should use default value when unit is not recognized', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') {
                  return '7x'; // unidade inválida
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

      const testService = module.get<RefreshTokenService>(RefreshTokenService);

      // Act
      await testService.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });
  });

  describe('storeRefreshToken', () => {
    it('should store token in Redis with correct key (refresh_token:domainId:userId:refreshToken)', async () => {
      // Arrange
      redisClient.setex.mockResolvedValue('OK');

      // Act
      await service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:${mockRefreshToken}`,
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });

    it('should store token in Redis with correct TTL (refreshTokenTtl)', async () => {
      // Arrange
      redisClient.setex.mockResolvedValue('OK');

      // Act
      await service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });

    it('should store userId as value in Redis', async () => {
      // Arrange
      redisClient.setex.mockResolvedValue('OK');

      // Act
      await service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        mockUserId,
      );
    });

    it('should call redisClient.setex with correct parameters', async () => {
      // Arrange
      redisClient.setex.mockResolvedValue('OK');

      // Act
      await service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:${mockRefreshToken}`,
        defaultRefreshTokenTtl,
        mockUserId,
      );
    });

    it('should not throw exception when successful', async () => {
      // Arrange
      redisClient.setex.mockResolvedValue('OK');

      // Act & Assert
      await expect(
        service.storeRefreshToken(mockDomainId, mockUserId, mockRefreshToken),
      ).resolves.not.toThrow();
    });
  });

  describe('validateRefreshToken', () => {
    it('should search token in Redis with correct key (refresh_token:domainId:userId:refreshToken)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockUserId);

      // Act
      await service.validateRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:${mockRefreshToken}`,
      );
    });

    it('should return true when token is found and value matches userId', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockUserId);

      // Act
      const result = await service.validateRefreshToken(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when token is not found', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.validateRefreshToken(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when value does not match userId', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('other-user-id');

      // Act
      const result = await service.validateRefreshToken(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should call redisClient.get with correct key', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockUserId);

      // Act
      await service.validateRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:${mockRefreshToken}`,
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should remove token from Redis with correct key (refresh_token:domainId:userId:refreshToken)', async () => {
      // Arrange
      redisClient.del.mockResolvedValue(1);

      // Act
      await service.revokeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:${mockRefreshToken}`,
      );
    });

    it('should call redisClient.del with correct key', async () => {
      // Arrange
      redisClient.del.mockResolvedValue(1);

      // Act
      await service.revokeRefreshToken(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:${mockRefreshToken}`,
      );
    });

    it('should not throw exception when successful', async () => {
      // Arrange
      redisClient.del.mockResolvedValue(1);

      // Act & Assert
      await expect(
        service.revokeRefreshToken(mockDomainId, mockUserId, mockRefreshToken),
      ).resolves.not.toThrow();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should search keys using correct pattern (refresh_token:domainId:userId:*)', async () => {
      // Arrange
      redisClient.keys.mockResolvedValue([]);

      // Act
      await service.revokeAllUserTokens(mockDomainId, mockUserId);

      // Assert
      expect(redisClient.keys).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:*`,
      );
    });

    it('should call redisClient.keys with correct pattern', async () => {
      // Arrange
      redisClient.keys.mockResolvedValue([]);

      // Act
      await service.revokeAllUserTokens(mockDomainId, mockUserId);

      // Assert
      expect(redisClient.keys).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:*`,
      );
    });

    it('should remove all keys when found', async () => {
      // Arrange
      const mockKeys = [
        `refresh_token:${mockDomainId}:${mockUserId}:token1`,
        `refresh_token:${mockDomainId}:${mockUserId}:token2`,
        `refresh_token:${mockDomainId}:${mockUserId}:token3`,
      ];
      redisClient.keys.mockResolvedValue(mockKeys);
      redisClient.del.mockResolvedValue(3);

      // Act
      await service.revokeAllUserTokens(mockDomainId, mockUserId);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(...mockKeys);
    });

    it('should call redisClient.del with all found keys', async () => {
      // Arrange
      const mockKeys = [
        `refresh_token:${mockDomainId}:${mockUserId}:token1`,
        `refresh_token:${mockDomainId}:${mockUserId}:token2`,
      ];
      redisClient.keys.mockResolvedValue(mockKeys);
      redisClient.del.mockResolvedValue(2);

      // Act
      await service.revokeAllUserTokens(mockDomainId, mockUserId);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(...mockKeys);
    });

    it('should not call redisClient.del when no keys are found', async () => {
      // Arrange
      redisClient.keys.mockResolvedValue([]);

      // Act
      await service.revokeAllUserTokens(mockDomainId, mockUserId);

      // Assert
      expect(redisClient.keys).toHaveBeenCalledWith(
        `refresh_token:${mockDomainId}:${mockUserId}:*`,
      );
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    it('should not throw exception when successful', async () => {
      // Arrange
      redisClient.keys.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.revokeAllUserTokens(mockDomainId, mockUserId),
      ).resolves.not.toThrow();
    });
  });
});

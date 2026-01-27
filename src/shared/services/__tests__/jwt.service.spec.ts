import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AppJwtService, JwtPayload } from '../jwt.service';
import { User } from '../../../users/domain/entities/user.entity';

describe('AppJwtService', () => {
  let service: AppJwtService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  // Test data
  const mockUserId = 'user-uuid';
  const mockDomainId = 'domain-uuid';
  const mockDomainSlug = 'test-domain';
  const mockEmail = 'user@example.com';
  const mockAccessToken = 'access-token-string';
  const mockRefreshToken = 'refresh-token-string';
  const mockToken = 'jwt-token-string';
  const mockAccessTokenExpiresIn = '2h';
  const mockRefreshTokenExpiresIn = '14d';

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: mockEmail,
    password_hash: 'hashed-password',
    full_name: 'Test User',
    phone: '+5511999999999',
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
    last_login_at: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as User;

  const mockJwtPayload: JwtPayload = {
    sub: mockUserId,
    email: mockEmail,
    domain_id: mockDomainId,
    domain_slug: mockDomainSlug,
    iat: 1234567890,
    exp: 1234571490,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppJwtService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue(mockAccessToken),
            verifyAsync: jest.fn().mockResolvedValue(mockJwtPayload),
            decode: jest.fn().mockReturnValue(mockJwtPayload),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                JWT_ACCESS_TOKEN_EXPIRES_IN: mockAccessTokenExpiresIn,
                JWT_REFRESH_TOKEN_EXPIRES_IN: mockRefreshTokenExpiresIn,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AppJwtService>(AppJwtService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload (sub, email, domain_id, domain_slug)', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockAccessToken);

      // Act
      await service.generateAccessToken(mockUser, mockDomainSlug);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUserId,
          email: mockEmail,
          domain_id: mockDomainId,
          domain_slug: mockDomainSlug,
        },
        expect.any(Object),
      );
    });

    it('should include domain_slug in payload when provided', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockAccessToken);

      // Act
      await service.generateAccessToken(mockUser, mockDomainSlug);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          domain_slug: mockDomainSlug,
        }),
        expect.any(Object),
      );
    });

    it('should not include domain_slug in payload when not provided', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockAccessToken);

      // Act
      await service.generateAccessToken(mockUser);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUserId,
          email: mockEmail,
          domain_id: mockDomainId,
          domain_slug: undefined,
        },
        expect.any(Object),
      );
    });

    it('should use JWT_ACCESS_TOKEN_EXPIRES_IN from ConfigService when defined', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockAccessToken);

      // Act
      await service.generateAccessToken(mockUser);

      // Assert
      expect(configService.get).toHaveBeenCalledWith(
        'JWT_ACCESS_TOKEN_EXPIRES_IN',
        '1h',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        {
          expiresIn: mockAccessTokenExpiresIn,
        },
      );
    });

    it('should use default value "1h" when JWT_ACCESS_TOKEN_EXPIRES_IN is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AppJwtService,
          {
            provide: JwtService,
            useValue: {
              signAsync: jest.fn().mockResolvedValue(mockAccessToken),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN') {
                  return defaultValue;
                }
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const testService = module.get<AppJwtService>(AppJwtService);
      const testJwtService = module.get(JwtService);

      // Act
      await testService.generateAccessToken(mockUser);

      // Assert
      expect(testJwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        {
          expiresIn: '1h',
        },
      );
    });

    it('should call jwtService.signAsync with payload and correct options', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockAccessToken);

      // Act
      await service.generateAccessToken(mockUser, mockDomainSlug);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUserId,
          email: mockEmail,
          domain_id: mockDomainId,
          domain_slug: mockDomainSlug,
        },
        {
          expiresIn: mockAccessTokenExpiresIn,
        },
      );
    });

    it('should return token string when successful', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockAccessToken);

      // Act
      const result = await service.generateAccessToken(mockUser);

      // Assert
      expect(result).toBe(mockAccessToken);
      expect(typeof result).toBe('string');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload (sub, email, domain_id, domain_slug)', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockRefreshToken);

      // Act
      await service.generateRefreshToken(mockUser, mockDomainSlug);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUserId,
          email: mockEmail,
          domain_id: mockDomainId,
          domain_slug: mockDomainSlug,
        },
        expect.any(Object),
      );
    });

    it('should include domain_slug in payload when provided', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockRefreshToken);

      // Act
      await service.generateRefreshToken(mockUser, mockDomainSlug);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          domain_slug: mockDomainSlug,
        }),
        expect.any(Object),
      );
    });

    it('should not include domain_slug in payload when not provided', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockRefreshToken);

      // Act
      await service.generateRefreshToken(mockUser);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUserId,
          email: mockEmail,
          domain_id: mockDomainId,
          domain_slug: undefined,
        },
        expect.any(Object),
      );
    });

    it('should use JWT_REFRESH_TOKEN_EXPIRES_IN from ConfigService when defined', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockRefreshToken);

      // Act
      await service.generateRefreshToken(mockUser);

      // Assert
      expect(configService.get).toHaveBeenCalledWith(
        'JWT_REFRESH_TOKEN_EXPIRES_IN',
        '7d',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        {
          expiresIn: mockRefreshTokenExpiresIn,
        },
      );
    });

    it('should use default value "7d" when JWT_REFRESH_TOKEN_EXPIRES_IN is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AppJwtService,
          {
            provide: JwtService,
            useValue: {
              signAsync: jest.fn().mockResolvedValue(mockRefreshToken),
            },
          },
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
        ],
      }).compile();

      const testService = module.get<AppJwtService>(AppJwtService);
      const testJwtService = module.get(JwtService);

      // Act
      await testService.generateRefreshToken(mockUser);

      // Assert
      expect(testJwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        {
          expiresIn: '7d',
        },
      );
    });

    it('should call jwtService.signAsync with payload and correct options', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockRefreshToken);

      // Act
      await service.generateRefreshToken(mockUser, mockDomainSlug);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUserId,
          email: mockEmail,
          domain_id: mockDomainId,
          domain_slug: mockDomainSlug,
        },
        {
          expiresIn: mockRefreshTokenExpiresIn,
        },
      );
    });

    it('should return token string when successful', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue(mockRefreshToken);

      // Act
      const result = await service.generateRefreshToken(mockUser);

      // Assert
      expect(result).toBe(mockRefreshToken);
      expect(typeof result).toBe('string');
    });
  });

  describe('verifyToken', () => {
    it('should verify token and return JwtPayload when valid', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);

      // Act
      const result = await service.verifyToken(mockToken);

      // Assert
      expect(result).toEqual(mockJwtPayload);
    });

    it('should call jwtService.verifyAsync with correct token', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);

      // Act
      await service.verifyToken(mockToken);

      // Assert
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken);
    });

    it('should return payload with correct properties (sub, email, domain_id, etc.)', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);

      // Act
      const result = await service.verifyToken(mockToken);

      // Assert
      expect(result).toHaveProperty('sub');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('domain_id');
      expect(result.sub).toBe(mockUserId);
      expect(result.email).toBe(mockEmail);
      expect(result.domain_id).toBe(mockDomainId);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      // Arrange
      const error = new Error('Invalid token');
      jwtService.verifyAsync.mockRejectedValue(error);

      // Act & Assert
      await expect(service.verifyToken(mockToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      // Arrange
      const error = new Error('Token expired');
      jwtService.verifyAsync.mockRejectedValue(error);

      // Act & Assert
      await expect(service.verifyToken(mockToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with message "Token invalid or expired"', async () => {
      // Arrange
      const error = new Error('Token expired');
      jwtService.verifyAsync.mockRejectedValue(error);

      // Act & Assert
      await expect(service.verifyToken(mockToken)).rejects.toThrow(
        'Token invalid or expired',
      );
    });

    it('should throw UnauthorizedException when jwtService.verifyAsync throws error', async () => {
      // Arrange
      const error = new Error('JWT verification failed');
      jwtService.verifyAsync.mockRejectedValue(error);

      // Act & Assert
      await expect(service.verifyToken(mockToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyToken(mockToken)).rejects.toThrow(
        'Token invalid or expired',
      );
    });
  });

  describe('decodeToken', () => {
    it('should decode token and return JwtPayload when valid', async () => {
      // Arrange
      jwtService.decode.mockReturnValue(mockJwtPayload);

      // Act
      const result = await service.decodeToken(mockToken);

      // Assert
      expect(result).toEqual(mockJwtPayload);
    });

    it('should call jwtService.decode with correct token', async () => {
      // Arrange
      jwtService.decode.mockReturnValue(mockJwtPayload);

      // Act
      await service.decodeToken(mockToken);

      // Assert
      expect(jwtService.decode).toHaveBeenCalledWith(mockToken);
    });

    it('should return payload with correct properties', async () => {
      // Arrange
      jwtService.decode.mockReturnValue(mockJwtPayload);

      // Act
      const result = await service.decodeToken(mockToken);

      // Assert
      expect(result).toHaveProperty('sub');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('domain_id');
      expect(result?.sub).toBe(mockUserId);
      expect(result?.email).toBe(mockEmail);
      expect(result?.domain_id).toBe(mockDomainId);
    });

    it('should return null when token is invalid', async () => {
      // Arrange
      jwtService.decode.mockReturnValue(null);

      // Act
      const result = await service.decodeToken(mockToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when jwtService.decode throws error', async () => {
      // Arrange
      jwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await service.decodeToken(mockToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should not throw exception when token is invalid (returns null)', async () => {
      // Arrange
      jwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.decodeToken(mockToken)).resolves.not.toThrow();
      const result = await service.decodeToken(mockToken);
      expect(result).toBeNull();
    });
  });
});

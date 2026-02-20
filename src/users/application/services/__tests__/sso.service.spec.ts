import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import axios from 'axios';
import { SsoService, GoogleUserInfo, MicrosoftUserInfo } from '../sso-service/sso.service';
import { UserService } from '../user-service/user.service';
import { AppJwtService } from '../../../../shared/services/jwt.service';
import { RefreshTokenService } from '../../../../shared/services/refresh-token.service';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { User } from '../../../domain/entities/user.entity';
import { APP_LOGGER } from '../../../../shared/utils/logger';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SsoService', () => {
  let service: SsoService;
  let configService: jest.Mocked<ConfigService>;
  let domainRepository: jest.Mocked<Repository<Domain>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<AppJwtService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let redisClient: jest.Mocked<Redis>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'user@example.com';
  const mockEmailDomain = 'example.com';
  const mockState = 'a'.repeat(64); // 64 hex characters
  const mockCode = 'authorization-code';
  const mockGoogleAccessToken = 'google-access-token';
  const mockMicrosoftAccessToken = 'microsoft-access-token';
  const mockAccessToken = 'jwt-access-token';
  const mockRefreshToken = 'jwt-refresh-token';
  const mockTenantId = 'tenant-uuid';

  // OAuth configuration
  const mockGoogleClientId = 'google-client-id';
  const mockGoogleClientSecret = 'google-client-secret';
  const mockGoogleRedirectUri = 'https://example.com/auth/google/callback';
  const mockMicrosoftClientId = 'microsoft-client-id';
  const mockMicrosoftClientSecret = 'microsoft-client-secret';
  const mockMicrosoftTenantId = 'tenant-uuid';
  const mockMicrosoftRedirectUri = 'https://example.com/auth/microsoft/callback';

  const mockDomain: Domain = {
    id: mockDomainId,
    slug: 'example-com',
    name: 'Example Domain',
    is_active: true,
    ms_tenant_id: mockTenantId,
    created_by: 'admin-uuid',
    created_at: new Date(),
    updated_at: new Date(),
  } as Domain;

  const mockGoogleUserInfo: GoogleUserInfo = {
    id: 'google-user-id',
    email: mockEmail,
    verified_email: true,
    name: 'Test User',
    picture: 'https://example.com/picture.jpg',
  };

  const mockMicrosoftUserInfo: MicrosoftUserInfo = {
    id: 'microsoft-user-id',
    mail: mockEmail,
    userPrincipalName: mockEmail,
    displayName: 'Test User',
    givenName: 'Test',
    surname: 'User',
    tenantId: mockTenantId,
  };

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: mockEmail,
    full_name: 'Test User',
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
    password_hash: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  beforeEach(async () => {
    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                GOOGLE_CLIENT_ID: mockGoogleClientId,
                GOOGLE_CLIENT_SECRET: mockGoogleClientSecret,
                GOOGLE_REDIRECT_URI: mockGoogleRedirectUri,
                MICROSOFT_CLIENT_ID: mockMicrosoftClientId,
                MICROSOFT_CLIENT_SECRET: mockMicrosoftClientSecret,
                MICROSOFT_TENANT_ID: mockMicrosoftTenantId,
                MICROSOFT_REDIRECT_URI: mockMicrosoftRedirectUri,
              };
              return config[key] || defaultValue || '';
            }),
          },
        },
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            updateLastLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AppJwtService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            storeRefreshToken: jest.fn().mockResolvedValue(undefined),
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

    service = module.get<SsoService>(SsoService);
    configService = module.get(ConfigService);
    domainRepository = module.get(getRepositoryToken(Domain));
    userRepository = module.get(getRepositoryToken(User));
    userService = module.get(UserService);
    jwtService = module.get(AppJwtService);
    refreshTokenService = module.get(RefreshTokenService);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateGoogleOAuth', () => {
    it('should generate authorization URL when Google OAuth is configured', async () => {
      // Act
      const result = await service.initiateGoogleOAuth();

      // Assert
      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.authUrl).toContain(`client_id=${mockGoogleClientId}`);
      expect(result.authUrl).toContain(`redirect_uri=${encodeURIComponent(mockGoogleRedirectUri)}`);
      expect(result.authUrl).toContain('scope=openid+email+profile');
      expect(result.authUrl).toContain(`state=${result.state}`);
      expect(result.state).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters
      expect(redisClient.setex).toHaveBeenCalledWith(
        `sso_state:${result.state}`,
        600,
        '',
      );
    });

    it('should generate unique state (hexadecimal of 64 characters)', async () => {
      // Act
      const result1 = await service.initiateGoogleOAuth();
      const result2 = await service.initiateGoogleOAuth();

      // Assert
      expect(result1.state).toMatch(/^[a-f0-9]{64}$/);
      expect(result2.state).toMatch(/^[a-f0-9]{64}$/);
      expect(result1.state).not.toBe(result2.state); // Should be unique
    });

    it('should store state in Redis with TTL of 10 minutes (600 seconds)', async () => {
      // Act
      const result = await service.initiateGoogleOAuth();

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `sso_state:${result.state}`,
        600,
        '',
      );
    });

    it('should include domainId in state when provided', async () => {
      // Act
      const result = await service.initiateGoogleOAuth(mockDomainId);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `sso_state:${result.state}`,
        600,
        mockDomainId,
      );
    });

    it('should include correct parameters in URL', async () => {
      // Act
      const result = await service.initiateGoogleOAuth();

      // Assert
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('access_type=offline');
      expect(result.authUrl).toContain('prompt=consent');
    });

    it('should throw BadRequestException when Google OAuth is not configured', async () => {
      // Arrange
      const moduleWithoutConfig: TestingModule = await Test.createTestingModule({
        providers: [
          SsoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''), // Empty config
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(User),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              update: jest.fn(),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              updateLastLogin: jest.fn(),
            },
          },
          {
            provide: AppJwtService,
            useValue: {
              generateAccessToken: jest.fn(),
              generateRefreshToken: jest.fn(),
            },
          },
          {
            provide: RefreshTokenService,
            useValue: {
              storeRefreshToken: jest.fn(),
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

      const serviceWithoutConfig = moduleWithoutConfig.get<SsoService>(SsoService);

      // Act & Assert
      await expect(serviceWithoutConfig.initiateGoogleOAuth()).rejects.toThrow(
        BadRequestException,
      );
      await expect(serviceWithoutConfig.initiateGoogleOAuth()).rejects.toThrow(
        'Google OAuth not configured',
      );
    });
  });

  describe('handleGoogleCallback', () => {
    it('should process callback when state is valid and code is valid', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      const result = await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      });
      expect(redisClient.get).toHaveBeenCalledWith(`sso_state:${mockState}`);
      expect(redisClient.del).toHaveBeenCalledWith(`sso_state:${mockState}`);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        {
          code: mockCode,
          client_id: mockGoogleClientId,
          client_secret: mockGoogleClientSecret,
          redirect_uri: mockGoogleRedirectUri,
          grant_type: 'authorization_code',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${mockGoogleAccessToken}`,
          },
        },
      );
    });

    it('should find domain when domainId is in state', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      // Should not try domain discovery strategies
      expect(domainRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should discover domain by email domain when domainId is not in state', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(''); // Empty domainId
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      // When domainId is empty, it skips the first findOne and goes directly to discovery
      // First discovery strategy finds domain by slug
      domainRepository.findOne.mockResolvedValueOnce(mockDomain); // Found by slug
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      // Should not try to find by empty id, goes directly to discovery
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockEmailDomain, is_active: true },
      });
      expect(domainRepository.findOne).not.toHaveBeenCalledWith({
        where: { id: '', is_active: true },
      });
    });

    it('should try multiple domain discovery strategies', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('');
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      // Try slug exact, then slug with hyphens, then first part
      // When domainId is empty, it skips the first findOne
      domainRepository.findOne
        .mockResolvedValueOnce(null) // Slug exact not found
        .mockResolvedValueOnce(null) // Slug with hyphens not found
        .mockResolvedValueOnce(mockDomain); // First part found
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert - verify all strategies were tried
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockEmailDomain, is_active: true },
      });
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockEmailDomain.replace(/\./g, '-'), is_active: true },
      });
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockEmailDomain.split('.')[0], is_active: true },
      });
    });

    it('should create user when user does not exist', async () => {
      // Arrange
      const mockCreatedUser = { ...mockUser, id: 'new-user-uuid' };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockCreatedUser as User);
      userRepository.save.mockResolvedValue(mockCreatedUser as User);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith({
        domain_id: mockDomainId,
        email: mockGoogleUserInfo.email,
        full_name: mockGoogleUserInfo.name,
        is_verified: mockGoogleUserInfo.verified_email,
        password_hash: null,
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should update existing user (is_verified) when needed', async () => {
      // Arrange
      const unverifiedUser = { ...mockUser, is_verified: false };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(unverifiedUser);
      userRepository.update.mockResolvedValue(undefined as any);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockUserId },
        { is_verified: true },
      );
    });

    it('should generate JWT tokens and store refresh token', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
        mockUser,
        mockDomain.slug,
      );
      expect(jwtService.generateRefreshToken).toHaveBeenCalledWith(
        mockUser,
        mockDomain.slug,
      );
      expect(refreshTokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
      expect(userService.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should remove state from Redis after use', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleGoogleCallback(mockCode, mockState);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(`sso_state:${mockState}`);
    });

    it('should throw BadRequestException when state is invalid or expired', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.handleGoogleCallback(mockCode, mockState),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.handleGoogleCallback(mockCode, mockState),
      ).rejects.toThrow('State invalid or expired');

      expect(redisClient.get).toHaveBeenCalledWith(`sso_state:${mockState}`);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when domain is not found', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('');
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockGoogleUserInfo,
      } as any);
      // All domain discovery strategies fail
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.handleGoogleCallback(mockCode, mockState),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.handleGoogleCallback(mockCode, mockState),
      ).rejects.toThrow(
        `Domain not found for email ${mockGoogleUserInfo.email}. ` +
          `Check if the domain is registered and active, or provide the domain_id in the request parameter.`,
      );
    });

    it('should propagate axios errors (token exchange)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      const axiosError = new Error('Token exchange failed');
      mockedAxios.post.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        service.handleGoogleCallback(mockCode, mockState),
      ).rejects.toThrow('Token exchange failed');
    });

    it('should propagate axios errors (user info)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockGoogleAccessToken },
      } as any);
      const axiosError = new Error('User info failed');
      mockedAxios.get.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        service.handleGoogleCallback(mockCode, mockState),
      ).rejects.toThrow('User info failed');
    });
  });

  describe('initiateMicrosoftOAuth', () => {
    it('should generate authorization URL when Microsoft OAuth is configured', async () => {
      // Act
      const result = await service.initiateMicrosoftOAuth();

      // Assert
      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toContain(
        `https://login.microsoftonline.com/${mockMicrosoftTenantId}/oauth2/v2.0/authorize`,
      );
      expect(result.authUrl).toContain(`client_id=${mockMicrosoftClientId}`);
      expect(result.authUrl).toContain(
        `redirect_uri=${encodeURIComponent(mockMicrosoftRedirectUri)}`,
      );
      expect(result.authUrl).toContain('scope=openid+email+profile+User.Read');
      expect(result.authUrl).toContain(`state=${result.state}`);
      expect(result.state).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters
      expect(redisClient.setex).toHaveBeenCalledWith(
        `sso_state:${result.state}`,
        600,
        '',
      );
    });

    it('should generate unique state (hexadecimal of 64 characters)', async () => {
      // Act
      const result1 = await service.initiateMicrosoftOAuth();
      const result2 = await service.initiateMicrosoftOAuth();

      // Assert
      expect(result1.state).toMatch(/^[a-f0-9]{64}$/);
      expect(result2.state).toMatch(/^[a-f0-9]{64}$/);
      expect(result1.state).not.toBe(result2.state); // Should be unique
    });

    it('should store state in Redis with TTL of 10 minutes (600 seconds)', async () => {
      // Act
      const result = await service.initiateMicrosoftOAuth();

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `sso_state:${result.state}`,
        600,
        '',
      );
    });

    it('should include domainId in state when provided', async () => {
      // Act
      const result = await service.initiateMicrosoftOAuth(mockDomainId);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `sso_state:${result.state}`,
        600,
        mockDomainId,
      );
    });

    it('should use correct tenant (microsoftTenantId or common)', async () => {
      // Act
      const result = await service.initiateMicrosoftOAuth();

      // Assert
      expect(result.authUrl).toContain(
        `https://login.microsoftonline.com/${mockMicrosoftTenantId}/oauth2/v2.0/authorize`,
      );
    });

    it('should use common tenant when tenantId is not configured', async () => {
      // Arrange
      const moduleWithCommonTenant: TestingModule = await Test.createTestingModule({
        providers: [
          SsoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const config: Record<string, string> = {
                  GOOGLE_CLIENT_ID: mockGoogleClientId,
                  GOOGLE_CLIENT_SECRET: mockGoogleClientSecret,
                  GOOGLE_REDIRECT_URI: mockGoogleRedirectUri,
                  MICROSOFT_CLIENT_ID: mockMicrosoftClientId,
                  MICROSOFT_CLIENT_SECRET: mockMicrosoftClientSecret,
                  MICROSOFT_TENANT_ID: '', // Empty - should use 'common'
                  MICROSOFT_REDIRECT_URI: mockMicrosoftRedirectUri,
                };
                return config[key] || defaultValue || '';
              }),
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(User),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              update: jest.fn(),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              updateLastLogin: jest.fn(),
            },
          },
          {
            provide: AppJwtService,
            useValue: {
              generateAccessToken: jest.fn(),
              generateRefreshToken: jest.fn(),
            },
          },
          {
            provide: RefreshTokenService,
            useValue: {
              storeRefreshToken: jest.fn(),
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

      const serviceWithCommonTenant = moduleWithCommonTenant.get<SsoService>(SsoService);

      // Act
      const result = await serviceWithCommonTenant.initiateMicrosoftOAuth();

      // Assert
      expect(result.authUrl).toContain(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      );
    });

    it('should include correct parameters in URL', async () => {
      // Act
      const result = await service.initiateMicrosoftOAuth();

      // Assert
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('response_mode=query');
      expect(result.authUrl).toContain('prompt=select_account');
    });

    it('should throw BadRequestException when Microsoft OAuth is not configured', async () => {
      // Arrange
      const moduleWithoutConfig: TestingModule = await Test.createTestingModule({
        providers: [
          SsoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''), // Empty config
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(User),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              update: jest.fn(),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              updateLastLogin: jest.fn(),
            },
          },
          {
            provide: AppJwtService,
            useValue: {
              generateAccessToken: jest.fn(),
              generateRefreshToken: jest.fn(),
            },
          },
          {
            provide: RefreshTokenService,
            useValue: {
              storeRefreshToken: jest.fn(),
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

      const serviceWithoutConfig = moduleWithoutConfig.get<SsoService>(SsoService);

      // Act & Assert
      await expect(serviceWithoutConfig.initiateMicrosoftOAuth()).rejects.toThrow(
        BadRequestException,
      );
      await expect(serviceWithoutConfig.initiateMicrosoftOAuth()).rejects.toThrow(
        'Microsoft OAuth not configured',
      );
    });
  });

  describe('handleMicrosoftCallback', () => {
    it('should process callback when state is valid and code is valid', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      const result = await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      });
      expect(redisClient.get).toHaveBeenCalledWith(`sso_state:${mockState}`);
      expect(redisClient.del).toHaveBeenCalledWith(`sso_state:${mockState}`);
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        {
          headers: {
            Authorization: `Bearer ${mockMicrosoftAccessToken}`,
          },
        },
      );
    });

    it('should find domain when domainId is in state', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      // Should not try tenant discovery
      expect(domainRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should discover domain by ms_tenant_id when domainId is not in state', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('');
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      // When domainId is empty, it skips the first findOne and goes directly to tenant discovery
      domainRepository.findOne.mockResolvedValueOnce(mockDomain); // Found by tenant ID
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      // Should not try to find by empty id, goes directly to tenant discovery
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { ms_tenant_id: mockTenantId, is_active: true },
      });
      expect(domainRepository.findOne).not.toHaveBeenCalledWith({
        where: { id: '', is_active: true },
      });
    });

    it('should use email from mail or userPrincipalName', async () => {
      // Arrange
      const microsoftUserWithMail = {
        ...mockMicrosoftUserInfo,
        mail: 'mail@example.com',
        userPrincipalName: 'upn@example.com',
      };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: microsoftUserWithMail,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        'mail@example.com', // Should use mail first
      );
    });

    it('should use userPrincipalName when mail is not available', async () => {
      // Arrange
      const microsoftUserWithoutMail = {
        ...mockMicrosoftUserInfo,
        mail: undefined,
        userPrincipalName: 'upn@example.com',
      };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: microsoftUserWithoutMail,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        'upn@example.com', // Should use userPrincipalName
      );
    });

    it('should create user when user does not exist', async () => {
      // Arrange
      const mockCreatedUser = { ...mockUser, id: 'new-user-uuid' };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockCreatedUser as User);
      userRepository.save.mockResolvedValue(mockCreatedUser as User);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith({
        domain_id: mockDomainId,
        email: mockEmail,
        full_name: mockMicrosoftUserInfo.displayName,
        is_verified: true,
        password_hash: null,
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should create user with full name from givenName and surname when displayName is not available', async () => {
      // Arrange
      const microsoftUserWithoutDisplayName = {
        ...mockMicrosoftUserInfo,
        displayName: undefined,
        givenName: 'Test',
        surname: 'User',
      };
      const mockCreatedUser = { ...mockUser, id: 'new-user-uuid' };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: microsoftUserWithoutDisplayName,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockCreatedUser as User);
      userRepository.save.mockResolvedValue(mockCreatedUser as User);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith({
        domain_id: mockDomainId,
        email: mockEmail,
        full_name: 'Test User',
        is_verified: true,
        password_hash: null,
      });
    });

    it('should update existing user (is_verified) when needed', async () => {
      // Arrange
      const unverifiedUser = { ...mockUser, is_verified: false };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(unverifiedUser);
      userRepository.update.mockResolvedValue(undefined as any);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockUserId },
        { is_verified: true },
      );
    });

    it('should generate JWT tokens and store refresh token', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
        mockUser,
        mockDomain.slug,
      );
      expect(jwtService.generateRefreshToken).toHaveBeenCalledWith(
        mockUser,
        mockDomain.slug,
      );
      expect(refreshTokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
      expect(userService.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should remove state from Redis after use', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      await service.handleMicrosoftCallback(mockCode, mockState);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(`sso_state:${mockState}`);
    });

    it('should throw BadRequestException when state is invalid or expired', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow('State invalid or expired');

      expect(redisClient.get).toHaveBeenCalledWith(`sso_state:${mockState}`);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when email is not found in Microsoft profile', async () => {
      // Arrange
      const microsoftUserWithoutEmail = {
        ...mockMicrosoftUserInfo,
        mail: undefined,
        userPrincipalName: undefined,
      };
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: microsoftUserWithoutEmail,
      } as any);

      // Act & Assert
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow('Email não encontrado no perfil Microsoft');
    });

    it('should throw NotFoundException when domain is not found', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('');
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      mockedAxios.get.mockResolvedValue({
        data: mockMicrosoftUserInfo,
      } as any);
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow(
        `Domain not found for Microsoft tenant ${mockTenantId}. Contact the administrator.`,
      );
    });

    it('should propagate axios errors (token exchange)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      const axiosError = new Error('Token exchange failed');
      mockedAxios.post.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow('Token exchange failed');
    });

    it('should propagate axios errors (user info)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(mockDomainId);
      mockedAxios.post.mockResolvedValue({
        data: { access_token: mockMicrosoftAccessToken },
      } as any);
      const axiosError = new Error('User info failed');
      mockedAxios.get.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        service.handleMicrosoftCallback(mockCode, mockState),
      ).rejects.toThrow('User info failed');
    });
  });
});

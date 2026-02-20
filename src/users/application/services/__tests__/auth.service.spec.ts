import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth-service/auth.service';
import { UserService } from '../user-service/user.service';
import { PasswordService } from '../../../../shared/services/password.service';
import { AppJwtService } from '../../../../shared/services/jwt.service';
import { RefreshTokenService } from '../../../../shared/services/refresh-token.service';
import { MfaService } from '../mfa-service/mfa.service';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { APP_LOGGER } from '../../../../shared/utils/logger';
import { User } from '../../../domain/entities/user.entity';
import { MfaType } from '../../../domain/entities/user-mfa.entity';
import { LoginDto } from '../../dtos/login.dto';
import { CreateUserDto } from '../../dtos/create-user.dto';
import { UserResponseDto } from '../../dtos/user-response.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let passwordService: jest.Mocked<PasswordService>;
  let jwtService: jest.Mocked<AppJwtService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let mfaService: jest.Mocked<MfaService>;
  let domainRepository: jest.Mocked<Repository<Domain>>;
  let redisClient: {
    setex: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
  };

  // Dados de teste
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockHashedPassword = 'hashed-password';
  const mockAccessToken = 'access-token';
  const mockRefreshToken = 'refresh-token';
  const mockMfaToken = 'mfa-token';
  const mockMfaCode = '123456';

  const mockDomain: Domain = {
    id: mockDomainId,
    slug: 'test-domain',
    is_active: true,
    name: 'Test Domain',
    created_by: 'admin-uuid',
    created_at: new Date(),
    updated_at: new Date(),
  } as Domain;

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: mockEmail,
    password_hash: mockHashedPassword,
    is_active: true,
    mfa_enabled: false,
    is_verified: false,
    full_name: 'Test User',
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  const mockUserResponse: UserResponseDto = {
    id: mockUserId,
    email: mockEmail,
    full_name: 'Test User',
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCreateUserDto: CreateUserDto = {
    email: mockEmail,
    password: mockPassword,
    full_name: 'Test User',
  };

  const mockLoginDto: LoginDto = {
    domain_id: mockDomainId,
    email: mockEmail,
    password: mockPassword,
  };

  const mockJwtPayload = {
    sub: mockUserId,
    email: mockEmail,
    domain_id: mockDomainId,
  };

  beforeEach(async () => {
    // Mock do Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };

    // Mock do RefreshTokenService com redisClient
    const mockRefreshTokenService = {
      storeRefreshToken: jest.fn().mockResolvedValue(undefined),
      validateRefreshToken: jest.fn().mockResolvedValue(true),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
      redisClient: redisClient,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            updateLastLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            comparePassword: jest.fn(),
          },
        },
        {
          provide: AppJwtService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: MfaService,
          useValue: {
            verifyMfa: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: APP_LOGGER,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    passwordService = module.get(PasswordService);
    jwtService = module.get(AppJwtService);
    refreshTokenService = module.get(RefreshTokenService);
    mfaService = module.get(MfaService);
    domainRepository = module.get(getRepositoryToken(Domain));

    // Configurar redisClient no refreshTokenService
    (refreshTokenService as any).redisClient = redisClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('You must register a user when the domain exists and is active', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.create.mockResolvedValue(mockUserResponse);

      // Act
      const result = await service.register(mockDomainId, mockCreateUserDto);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      expect(userService.create).toHaveBeenCalledWith(
        mockDomainId,
        mockCreateUserDto,
      );
    });

    it('It should throw a NotFoundException when the domain does not exist', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.register(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.register(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow('Domain not found or inactive');

      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('It should throw a NotFoundException when the domain exists but is inactive', async () => {
      // Arrange
      const inactiveDomain = { ...mockDomain, is_active: false };
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.register(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.register(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow('Domain not found or inactive');

      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      expect(userService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('It should login successfully when the credentials are correct and MFA is not enabled', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(true);
      jwtService.generateAccessToken.mockResolvedValue(mockAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      // Act
      const result = await service.login(mockLoginDto);

      // Assert
      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
        mfa_required: false,
      });
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(passwordService.comparePassword).toHaveBeenCalledWith(
        mockPassword,
        mockHashedPassword,
      );
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
        mockUser,
        mockDomain.slug,
      );
      expect(jwtService.generateRefreshToken).toHaveBeenCalledWith(
        mockUser,
        mockDomain.slug,
      );
      expect(userService.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(refreshTokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
    });

    it('It should return mfa_required: true and mfa_token when MFA is enabled', async () => {
      // Arrange
      const userWithMfa = { ...mockUser, mfa_enabled: true };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(userWithMfa);
      passwordService.comparePassword.mockResolvedValue(true);
      jwtService.generateAccessToken.mockResolvedValue(mockMfaToken);

      // Act
      const result = await service.login(mockLoginDto);

      // Assert
      expect(result).toEqual({
        mfa_required: true,
        mfa_token: mockMfaToken,
        available_methods: [MfaType.TOTP],
        message: 'MFA is required. Please provide the MFA code.',
      });
      expect(redisClient.setex).toHaveBeenCalledWith(
        `mfa_challenge:${mockDomainId}:${mockUserId}:${mockMfaToken}`,
        900,
        JSON.stringify({ userId: mockUserId, domainId: mockDomainId }),
      );
      expect(userService.updateLastLogin).not.toHaveBeenCalled();
      expect(refreshTokenService.storeRefreshToken).not.toHaveBeenCalled();
    });

    it('It should throw a NotFoundException when the domain does not exist', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Domain not found or inactive',
      );

      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('It should throw a NotFoundException when the domain is inactive', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Domain not found or inactive',
      );

      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId, is_active: true },
      });
      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the user does not exist', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(passwordService.comparePassword).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the user is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, is_active: false };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'User inactive',
      );

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(passwordService.comparePassword).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the user does not have a password_hash', async () => {
      // Arrange
      const userWithoutPassword = { ...mockUser, password_hash: null };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(userWithoutPassword);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(passwordService.comparePassword).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the password is incorrect', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(passwordService.comparePassword).toHaveBeenCalledWith(
        mockPassword,
        mockHashedPassword,
      );
      expect(jwtService.generateAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('It should refresh tokens when the refresh token is valid', async () => {
      // Arrange
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      refreshTokenService.validateRefreshToken.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue(mockUser);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      jwtService.generateAccessToken.mockResolvedValue(newAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(newRefreshToken);

      // Act
      const result = await service.refreshToken(
        mockDomainId,
        mockRefreshToken,
      );

      // Assert
      expect(result).toEqual({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      });
      expect(jwtService.verifyToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
      expect(refreshTokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        newRefreshToken,
      );
    });

    it('It should throw a UnauthorizedException when the token does not belong to the domain', async () => {
      // Arrange
      const wrongDomainPayload = {
        ...mockJwtPayload,
        domain_id: 'wrong-domain-id',
      };
      jwtService.verifyToken.mockResolvedValue(wrongDomainPayload);

      // Act & Assert
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow('Token does not belong to this domain');

      expect(jwtService.verifyToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(refreshTokenService.validateRefreshToken).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the refresh token is invalid or expired', async () => {
      // Arrange
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      refreshTokenService.validateRefreshToken.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow('Refresh token invalid or expired');

      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the user does not exist', async () => {
      // Arrange
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      refreshTokenService.validateRefreshToken.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow('User not found or inactive');

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });

    it('It should throw a UnauthorizedException when the user is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, is_active: false };
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      refreshTokenService.validateRefreshToken.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(mockDomainId, mockRefreshToken),
      ).rejects.toThrow('User not found or inactive');

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });
  });

  describe('logout', () => {
    it('It should revoke a specific refresh token when provided', async () => {
      // Act
      await service.logout(mockDomainId, mockUserId, mockRefreshToken);

      // Assert
      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRefreshToken,
      );
      expect(refreshTokenService.revokeAllUserTokens).not.toHaveBeenCalled();
    });

    it('It should revoke all user tokens when the refresh token is not provided', async () => {
      // Act
      await service.logout(mockDomainId, mockUserId);

      // Assert
      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(refreshTokenService.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('verifyMfaChallenge', () => {
    it('It should verify the MFA code successfully when the code is valid', async () => {
      // Arrange
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      redisClient.get.mockResolvedValue(
        JSON.stringify({ userId: mockUserId, domainId: mockDomainId }),
      );
      mfaService.verifyMfa.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue(mockUser);
      domainRepository.findOne.mockResolvedValue(mockDomain);
      jwtService.generateAccessToken.mockResolvedValue(newAccessToken);
      jwtService.generateRefreshToken.mockResolvedValue(newRefreshToken);

      // Act
      const result = await service.verifyMfaChallenge(
        mockMfaToken,
        mockMfaCode,
        MfaType.TOTP,
      );

      // Assert
      expect(result).toEqual({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
        mfa_required: false,
      });
      expect(jwtService.verifyToken).toHaveBeenCalledWith(mockMfaToken);
      expect(redisClient.get).toHaveBeenCalledWith(
        `mfa_challenge:${mockDomainId}:${mockUserId}:${mockMfaToken}`,
      );
      expect(mfaService.verifyMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockMfaCode,
        MfaType.TOTP,
      );
      expect(redisClient.del).toHaveBeenCalledWith(
        `mfa_challenge:${mockDomainId}:${mockUserId}:${mockMfaToken}`,
      );
      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(userService.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(refreshTokenService.storeRefreshToken).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        newRefreshToken,
      );
    });

    it('It should throw a UnauthorizedException when the MFA token does not exist in Redis', async () => {
      // Arrange
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      redisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow('MFA token invalid or expired');

      expect(redisClient.get).toHaveBeenCalledWith(
        `mfa_challenge:${mockDomainId}:${mockUserId}:${mockMfaToken}`,
      );
      expect(mfaService.verifyMfa).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the MFA token expired', async () => {
      // Arrange
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      redisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow('MFA token invalid or expired');

      expect(redisClient.get).toHaveBeenCalledWith(
        `mfa_challenge:${mockDomainId}:${mockUserId}:${mockMfaToken}`,
      );
      expect(mfaService.verifyMfa).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the MFA code is invalid', async () => {
      // Arrange
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      redisClient.get.mockResolvedValue(
        JSON.stringify({ userId: mockUserId, domainId: mockDomainId }),
      );
      mfaService.verifyMfa.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow('MFA code invalid');

      expect(mfaService.verifyMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockMfaCode,
        MfaType.TOTP,
      );
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    it('It should throw a UnauthorizedException when the user does not exist', async () => {
      // Arrange
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      redisClient.get.mockResolvedValue(
        JSON.stringify({ userId: mockUserId, domainId: mockDomainId }),
      );
      mfaService.verifyMfa.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow('User not found or inactive');

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });

    it('It should throw a UnauthorizedException when the user is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, is_active: false };
      jwtService.verifyToken.mockResolvedValue(mockJwtPayload);
      redisClient.get.mockResolvedValue(
        JSON.stringify({ userId: mockUserId, domainId: mockDomainId }),
      );
      mfaService.verifyMfa.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyMfaChallenge(mockMfaToken, mockMfaCode, MfaType.TOTP),
      ).rejects.toThrow('User not found or inactive');

      expect(userService.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });
  });
});

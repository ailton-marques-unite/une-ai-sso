import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../../../application/services/auth-service/auth.service';
import { CreateUserDto } from '../../../application/dtos/create-user.dto';
import { LoginDto } from '../../../application/dtos/login.dto';
import { RefreshTokenDto } from '../../../application/dtos/refresh-token.dto';
import { MfaChallengeDto } from '../../../application/dtos/mfa-challenge.dto';
import { UserResponseDto } from '../../../application/dtos/user-response.dto';
import { LoginResponseDto } from '../../../application/dtos/login-response.dto';
import { MfaType } from '../../../domain/entities/user-mfa.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'user@example.com';
  const mockPassword = 'ValidPassword123!@#';
  const mockRefreshToken = 'refresh-token-string';
  const mockMfaToken = 'mfa-token-string';
  const mockMfaCode = '123456';

  const mockCreateUserDto: CreateUserDto = {
    email: mockEmail,
    password: mockPassword,
    full_name: 'Test User',
    phone: '+5511999999999',
  };

  const mockLoginDto: LoginDto = {
    domain_id: mockDomainId,
    email: mockEmail,
    password: mockPassword,
  };

  const mockLoginDtoWithoutDomainId: LoginDto = {
    email: mockEmail,
    password: mockPassword,
  };

  const mockRefreshTokenDto: RefreshTokenDto = {
    refresh_token: mockRefreshToken,
  };

  const mockMfaChallengeDto: MfaChallengeDto = {
    mfa_token: mockMfaToken,
    code: mockMfaCode,
    method: MfaType.TOTP,
  };

  const mockMfaChallengeDtoWithoutMethod: MfaChallengeDto = {
    mfa_token: mockMfaToken,
    code: mockMfaCode,
  };

  const mockRequestWithDomainContext = {
    domainContext: {
      domainId: mockDomainId,
    },
  };

  const mockRequestWithUser = {
    domainContext: {
      domainId: mockDomainId,
    },
    user: {
      sub: mockUserId,
    },
  };

  const mockRequestEmpty = {};

  const mockUserResponse: UserResponseDto = {
    id: mockUserId,
    email: mockEmail,
    full_name: 'Test User',
    phone: '+5511999999999',
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  const mockLoginResponse: LoginResponseDto = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn().mockResolvedValue(undefined),
            verifyMfaChallenge: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register user when domainContext is present', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.register(mockCreateUserDto, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(authService.register).toHaveBeenCalledWith(mockDomainId, mockCreateUserDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('should call authService.register with correct domainId and createUserDto', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockUserResponse);

      // Act
      await controller.register(mockCreateUserDto, mockRequestWithDomainContext as any);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(mockDomainId, mockCreateUserDto);
    });

    it('should return UserResponseDto', async () => {
      // Arrange
      authService.register.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.register(mockCreateUserDto, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.register(mockCreateUserDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.register(mockCreateUserDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required for registration');

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should propagate AuthService errors (ConflictException)', async () => {
      // Arrange
      const conflictError = new ConflictException('Email already in use');
      authService.register.mockRejectedValue(conflictError);

      // Act & Assert
      await expect(
        controller.register(mockCreateUserDto, mockRequestWithDomainContext as any),
      ).rejects.toThrow(ConflictException);
      await expect(
        controller.register(mockCreateUserDto, mockRequestWithDomainContext as any),
      ).rejects.toThrow('Email already in use');
    });

    it('should propagate AuthService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Invalid password');
      authService.register.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(
        controller.register(mockCreateUserDto, mockRequestWithDomainContext as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.register(mockCreateUserDto, mockRequestWithDomainContext as any),
      ).rejects.toThrow('Invalid password');
    });
  });

  describe('login', () => {
    it('should login when domain_id is in loginDto', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(mockLoginDto, mockRequestEmpty as any);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith(mockLoginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should login when domain_id is not in loginDto but domainContext is present', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(mockLoginDtoWithoutDomainId, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith({
        ...mockLoginDtoWithoutDomainId,
        domain_id: mockDomainId,
      });
    });

    it('should use domain_id from loginDto when provided', async () => {
      // Arrange
      const customDomainId = 'custom-domain-uuid';
      const loginDtoWithCustomDomain: LoginDto = {
        domain_id: customDomainId,
        email: mockEmail,
        password: mockPassword,
      };
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(loginDtoWithCustomDomain, mockRequestWithDomainContext as any);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(loginDtoWithCustomDomain);
      expect(authService.login).toHaveBeenCalledWith(
        expect.objectContaining({ domain_id: customDomainId }),
      );
    });

    it('should use domainContext.domainId when domain_id is not in loginDto', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(mockLoginDtoWithoutDomainId, mockRequestWithDomainContext as any);

      // Assert
      expect(authService.login).toHaveBeenCalledWith({
        ...mockLoginDtoWithoutDomainId,
        domain_id: mockDomainId,
      });
    });

    it('should call authService.login with updated loginDto (with domain_id)', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.login(mockLoginDtoWithoutDomainId, mockRequestWithDomainContext as any);

      // Assert
      expect(authService.login).toHaveBeenCalledWith({
        email: mockEmail,
        password: mockPassword,
        domain_id: mockDomainId,
      });
    });

    it('should return LoginResponseDto', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(mockLoginDto, mockRequestEmpty as any);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw BadRequestException when domain_id and domainContext are absent', async () => {
      // Act & Assert
      await expect(
        controller.login(mockLoginDtoWithoutDomainId, mockRequestEmpty as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.login(mockLoginDtoWithoutDomainId, mockRequestEmpty as any),
      ).rejects.toThrow(
        'Domain context is required. Provide domain_id in the body or via header x-domain-id/x-domain-slug',
      );

      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should propagate AuthService errors (UnauthorizedException)', async () => {
      // Arrange
      const unauthorizedError = new UnauthorizedException('Invalid credentials');
      authService.login.mockRejectedValue(unauthorizedError);

      // Act & Assert
      await expect(
        controller.login(mockLoginDto, mockRequestEmpty as any),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.login(mockLoginDto, mockRequestEmpty as any),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should refresh token when domainContext is present', async () => {
      // Arrange
      authService.refreshToken.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.refresh(mockRefreshTokenDto, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.refreshToken).toHaveBeenCalledWith(mockDomainId, mockRefreshToken);
      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('should call authService.refreshToken with correct domainId and refresh_token', async () => {
      // Arrange
      authService.refreshToken.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.refresh(mockRefreshTokenDto, mockRequestWithDomainContext as any);

      // Assert
      expect(authService.refreshToken).toHaveBeenCalledWith(mockDomainId, mockRefreshToken);
    });

    it('should return LoginResponseDto', async () => {
      // Arrange
      authService.refreshToken.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.refresh(mockRefreshTokenDto, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.refresh(mockRefreshTokenDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.refresh(mockRefreshTokenDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required for refresh token');

      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('should propagate AuthService errors (UnauthorizedException)', async () => {
      // Arrange
      const unauthorizedError = new UnauthorizedException('Invalid refresh token');
      authService.refreshToken.mockRejectedValue(unauthorizedError);

      // Act & Assert
      await expect(
        controller.refresh(mockRefreshTokenDto, mockRequestWithDomainContext as any),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.refresh(mockRefreshTokenDto, mockRequestWithDomainContext as any),
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should logout when domainContext and user are present', async () => {
      // Arrange
      authService.logout.mockResolvedValue(undefined);

      // Act
      const result = await controller.logout({}, mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
      expect(authService.logout).toHaveBeenCalledWith(mockDomainId, mockUserId, undefined);
      expect(authService.logout).toHaveBeenCalledTimes(1);
    });

    it('should call authService.logout with correct domainId, userId and refresh_token', async () => {
      // Arrange
      authService.logout.mockResolvedValue(undefined);

      // Act
      await controller.logout({ refresh_token: mockRefreshToken }, mockRequestWithUser as any);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(mockDomainId, mockUserId, mockRefreshToken);
    });

    it('should return object with success: true and message: "Logout successful"', async () => {
      // Arrange
      authService.logout.mockResolvedValue(undefined);

      // Act
      const result = await controller.logout({}, mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout successful');
    });

    it('should work with refresh_token in body', async () => {
      // Arrange
      authService.logout.mockResolvedValue(undefined);

      // Act
      await controller.logout({ refresh_token: mockRefreshToken }, mockRequestWithUser as any);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(mockDomainId, mockUserId, mockRefreshToken);
    });

    it('should work without refresh_token in body', async () => {
      // Arrange
      authService.logout.mockResolvedValue(undefined);

      // Act
      await controller.logout({}, mockRequestWithUser as any);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(mockDomainId, mockUserId, undefined);
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Arrange
      const requestWithoutDomain = {
        user: {
          sub: mockUserId,
        },
      };

      // Act & Assert
      await expect(
        controller.logout({}, requestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.logout({}, requestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(authService.logout).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Arrange
      const requestWithoutUser = {
        domainContext: {
          domainId: mockDomainId,
        },
      };

      // Act & Assert
      await expect(
        controller.logout({}, requestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.logout({}, requestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(authService.logout).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.logout({}, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.logout({}, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate AuthService errors', async () => {
      // Arrange
      const serviceError = new Error('Service error');
      authService.logout.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.logout({}, mockRequestWithUser as any),
      ).rejects.toThrow('Service error');
    });
  });

  describe('verifyMfaChallenge', () => {
    it('should verify MFA code when data is valid', async () => {
      // Arrange
      authService.verifyMfaChallenge.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.verifyMfaChallenge(mockMfaChallengeDto);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.verifyMfaChallenge).toHaveBeenCalledWith(
        mockMfaToken,
        mockMfaCode,
        MfaType.TOTP,
      );
      expect(authService.verifyMfaChallenge).toHaveBeenCalledTimes(1);
    });

    it('should call authService.verifyMfaChallenge with correct mfa_token, code and method', async () => {
      // Arrange
      authService.verifyMfaChallenge.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.verifyMfaChallenge(mockMfaChallengeDto);

      // Assert
      expect(authService.verifyMfaChallenge).toHaveBeenCalledWith(
        mockMfaToken,
        mockMfaCode,
        MfaType.TOTP,
      );
    });

    it('should return LoginResponseDto', async () => {
      // Arrange
      authService.verifyMfaChallenge.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.verifyMfaChallenge(mockMfaChallengeDto);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should work with method provided', async () => {
      // Arrange
      authService.verifyMfaChallenge.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.verifyMfaChallenge(mockMfaChallengeDto);

      // Assert
      expect(authService.verifyMfaChallenge).toHaveBeenCalledWith(
        mockMfaToken,
        mockMfaCode,
        MfaType.TOTP,
      );
    });

    it('should work without method (optional)', async () => {
      // Arrange
      authService.verifyMfaChallenge.mockResolvedValue(mockLoginResponse);

      // Act
      await controller.verifyMfaChallenge(mockMfaChallengeDtoWithoutMethod);

      // Assert
      expect(authService.verifyMfaChallenge).toHaveBeenCalledWith(
        mockMfaToken,
        mockMfaCode,
        undefined,
      );
    });

    it('should propagate AuthService errors (UnauthorizedException)', async () => {
      // Arrange
      const unauthorizedError = new UnauthorizedException('Invalid MFA code');
      authService.verifyMfaChallenge.mockRejectedValue(unauthorizedError);

      // Act & Assert
      await expect(
        controller.verifyMfaChallenge(mockMfaChallengeDto),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.verifyMfaChallenge(mockMfaChallengeDto),
      ).rejects.toThrow('Invalid MFA code');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { PasswordRecoveryService } from '../password-recovery-service/password-recovery.service';
import { UserService } from '../user-service/user.service';
import { PasswordService } from '../../../../shared/services/password.service';
import { EmailService } from '../../../../shared/services/email.service';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity';
import { Domain } from '../../../../domains/domain/entities/domain.entity';
import { User } from '../../../domain/entities/user.entity';
import { ForgotPasswordDto } from '../../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../../dtos/reset-password.dto';

describe('PasswordRecoveryService', () => {
  let service: PasswordRecoveryService;
  let userService: jest.Mocked<UserService>;
  let passwordService: jest.Mocked<PasswordService>;
  let emailService: jest.Mocked<EmailService>;
  let passwordResetTokenRepository: jest.Mocked<Repository<PasswordResetToken>>;
  let domainRepository: jest.Mocked<Repository<Domain>>;
  let redisClient: jest.Mocked<Redis>;
  let configService: jest.Mocked<ConfigService>;
  let mockUserRepository: {
    update: jest.Mock;
  };

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'test@example.com';
  const mockToken = 'a'.repeat(64); // 64 hex characters
  const mockNewPassword = 'NewPassword123!@#';
  const mockHashedPassword = 'new-hashed-password';
  const mockTokenTtl = 1800; // 30 minutes in seconds

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: mockEmail,
    password_hash: 'old-hashed-password',
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
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

  const mockPasswordResetToken: PasswordResetToken = {
    id: 'token-uuid',
    user_id: mockUserId,
    token: mockToken,
    expires_at: new Date(Date.now() + mockTokenTtl * 1000),
    used_at: null,
    user: mockUser,
    created_at: new Date(),
  } as PasswordResetToken;

  const mockForgotPasswordDto: ForgotPasswordDto = {
    email: mockEmail,
  };

  const mockResetPasswordDto: ResetPasswordDto = {
    token: mockToken,
    new_password: mockNewPassword,
  };

  beforeEach(async () => {
    // Mock UserRepository (accessed via userService['userRepository'])
    mockUserRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
        {
          provide: 'REDIS_CLIENT',
          useValue: redisClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN') {
                return defaultValue || '30m';
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            userRepository: mockUserRepository,
          },
        },
        {
          provide: PasswordService,
          useValue: {
            validatePasswordStrength: jest.fn(),
            hashPassword: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            isConfigured: true,
          },
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordRecoveryService>(PasswordRecoveryService);
    userService = module.get(UserService);
    passwordService = module.get(PasswordService);
    emailService = module.get(EmailService);
    passwordResetTokenRepository = module.get(getRepositoryToken(PasswordResetToken));
    domainRepository = module.get(getRepositoryToken(Domain));
    redisClient = module.get('REDIS_CLIENT');
    configService = module.get(ConfigService);

    // Configure userRepository on userService
    (userService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('should request password reset when user exists', async () => {
      // Arrange
      const mockCreatedToken = { ...mockPasswordResetToken };
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.create.mockReturnValue(mockCreatedToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockCreatedToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      const result = await service.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Se o email existir, um link de recuperação será enviado',
      });
      expect(userService.findByEmail).toHaveBeenCalledWith(mockDomainId, mockEmail);
      expect(passwordResetTokenRepository.create).toHaveBeenCalled();
      expect(passwordResetTokenRepository.save).toHaveBeenCalled();
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockEmail,
        expect.any(String), // token generated
        mockDomain.name,
      );
      
      // Verify token is stored in Redis
      const redisCall = redisClient.setex.mock.calls[0];
      expect(redisCall[0]).toMatch(/^password_reset:domain-uuid:user-uuid:/);
      expect(redisCall[1]).toBe(mockTokenTtl);
      expect(redisCall[2]).toBe(mockUserId);
    });

    it('should return success message even when user does not exist (for security)', async () => {
      // Arrange
      userService.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Se o email existir, um link de recuperação será enviado',
      });
      expect(userService.findByEmail).toHaveBeenCalledWith(mockDomainId, mockEmail);
      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should generate unique token', async () => {
      // Arrange
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.create.mockReturnValue(mockPasswordResetToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockPasswordResetToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert
      const createCall = passwordResetTokenRepository.create.mock.calls[0][0];
      expect(createCall.token).toBeDefined();
      expect(createCall.token).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters
    });

    it('should save token with correct expiration', async () => {
      // Arrange
      const beforeCall = new Date();
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.create.mockReturnValue(mockPasswordResetToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockPasswordResetToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert
      const afterCall = new Date();
      const createCall = passwordResetTokenRepository.create.mock.calls[0][0];
      expect(createCall.expires_at).toBeInstanceOf(Date);
      
      const expiresAt = createCall.expires_at as Date;
      const expectedMin = new Date(beforeCall.getTime() + mockTokenTtl * 1000 - 1000);
      const expectedMax = new Date(afterCall.getTime() + mockTokenTtl * 1000 + 1000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should store token in Redis with correct TTL', async () => {
      // Arrange
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.create.mockReturnValue(mockPasswordResetToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockPasswordResetToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledTimes(1);
      const redisCall = redisClient.setex.mock.calls[0];
      expect(redisCall[0]).toMatch(/^password_reset:domain-uuid:user-uuid:/);
      expect(redisCall[1]).toBe(mockTokenTtl);
      expect(redisCall[2]).toBe(mockUserId);
    });

    it('should send email with domain name', async () => {
      // Arrange
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.create.mockReturnValue(mockPasswordResetToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockPasswordResetToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockEmail,
        expect.any(String),
        mockDomain.name,
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password when token is valid and not expired', async () => {
      // Arrange
      const validToken = { ...mockPasswordResetToken };
      passwordResetTokenRepository.findOne.mockResolvedValue(validToken);
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      passwordResetTokenRepository.save.mockResolvedValue(validToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      const result = await service.resetPassword(mockDomainId, mockResetPasswordDto);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Senha redefinida com sucesso',
      });
      expect(passwordResetTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: mockToken },
        relations: ['user'],
      });
      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(mockNewPassword);
      expect(passwordService.hashPassword).toHaveBeenCalledWith(mockNewPassword);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        { password_hash: mockHashedPassword },
      );
      expect(passwordResetTokenRepository.save).toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalledWith(
        `password_reset:${mockDomainId}:${mockUserId}:${mockToken}`,
      );
    });

    it('should throw BadRequestException when token does not exist', async () => {
      // Arrange
      passwordResetTokenRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow('Token inválido');

      expect(passwordResetTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: mockToken },
        relations: ['user'],
      });
      expect(passwordService.validatePasswordStrength).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when token is expired', async () => {
      // Arrange
      const expiredToken = {
        ...mockPasswordResetToken,
        expires_at: new Date(Date.now() - 1000), // 1 second ago
      };
      passwordResetTokenRepository.findOne.mockResolvedValue(expiredToken);

      // Act & Assert
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow('Token expirado');

      expect(passwordResetTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: mockToken },
        relations: ['user'],
      });
      expect(passwordService.validatePasswordStrength).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when token has already been used', async () => {
      // Arrange
      const usedToken = {
        ...mockPasswordResetToken,
        used_at: new Date(),
      };
      passwordResetTokenRepository.findOne.mockResolvedValue(usedToken);

      // Act & Assert
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow('Token já foi utilizado');

      expect(passwordResetTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: mockToken },
        relations: ['user'],
      });
      expect(passwordService.validatePasswordStrength).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when token does not belong to domain', async () => {
      // Arrange
      const userFromDifferentDomain = {
        ...mockUser,
        domain_id: 'different-domain-uuid',
      };
      const tokenWithWrongDomain = {
        ...mockPasswordResetToken,
        user: userFromDifferentDomain,
      };
      passwordResetTokenRepository.findOne.mockResolvedValue(tokenWithWrongDomain);

      // Act & Assert
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow('Token não pertence a este domínio');

      expect(passwordResetTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: mockToken },
        relations: ['user'],
      });
      expect(passwordService.validatePasswordStrength).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when password does not meet strength requirements', async () => {
      // Arrange
      const validToken = { ...mockPasswordResetToken };
      passwordResetTokenRepository.findOne.mockResolvedValue(validToken);
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password too weak', 'Missing uppercase letter'],
      });

      // Act & Assert
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword(mockDomainId, mockResetPasswordDto),
      ).rejects.toThrow('Password too weak, Missing uppercase letter');

      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(mockNewPassword);
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
    });

    it('should mark token as used after successful reset', async () => {
      // Arrange
      const validToken = { ...mockPasswordResetToken };
      passwordResetTokenRepository.findOne.mockResolvedValue(validToken);
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      passwordResetTokenRepository.save.mockResolvedValue(validToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.resetPassword(mockDomainId, mockResetPasswordDto);

      // Assert
      expect(passwordResetTokenRepository.save).toHaveBeenCalled();
      const savedToken = passwordResetTokenRepository.save.mock.calls[0][0];
      expect(savedToken.used_at).toBeInstanceOf(Date);
    });

    it('should remove token from Redis after successful reset', async () => {
      // Arrange
      const validToken = { ...mockPasswordResetToken };
      passwordResetTokenRepository.findOne.mockResolvedValue(validToken);
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      passwordResetTokenRepository.save.mockResolvedValue(validToken);
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.resetPassword(mockDomainId, mockResetPasswordDto);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(
        `password_reset:${mockDomainId}:${mockUserId}:${mockToken}`,
      );
    });
  });

  describe('parseExpiresIn (indirectly tested)', () => {
    it('should parse "30m" to 1800 seconds', async () => {
      // Arrange
      const testRedisClient = {
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordRecoveryService,
          {
            provide: 'REDIS_CLIENT',
            useValue: testRedisClient,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN') {
                  return '30m';
                }
                return undefined;
              }),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              userRepository: mockUserRepository,
            },
          },
          {
            provide: PasswordService,
            useValue: {
              validatePasswordStrength: jest.fn(),
              hashPassword: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendPasswordResetEmail: jest.fn(),
              isConfigured: true,
            },
          },
          {
            provide: getRepositoryToken(PasswordResetToken),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = module.get<PasswordRecoveryService>(PasswordRecoveryService);
      const testUserService = module.get<UserService>(UserService);
      const testPasswordResetTokenRepository = module.get<Repository<PasswordResetToken>>(
        getRepositoryToken(PasswordResetToken),
      );
      const testDomainRepository = module.get<Repository<Domain>>(
        getRepositoryToken(Domain),
      );

      (testUserService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (testPasswordResetTokenRepository.create as jest.Mock).mockReturnValue(mockPasswordResetToken);
      (testPasswordResetTokenRepository.save as jest.Mock).mockResolvedValue(mockPasswordResetToken);
      (testDomainRepository.findOne as jest.Mock).mockResolvedValue(mockDomain);

      // Act
      await testService.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert - verify TTL is 1800 seconds (30 minutes)
      const redisCall = testRedisClient.setex.mock.calls[0];
      expect(redisCall[1]).toBe(1800);
    });

    it('should parse "1h" to 3600 seconds', async () => {
      // Arrange
      const testRedisClient = {
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordRecoveryService,
          {
            provide: 'REDIS_CLIENT',
            useValue: testRedisClient,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN') {
                  return '1h';
                }
                return undefined;
              }),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              userRepository: mockUserRepository,
            },
          },
          {
            provide: PasswordService,
            useValue: {
              validatePasswordStrength: jest.fn(),
              hashPassword: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendPasswordResetEmail: jest.fn(),
              isConfigured: true,
            },
          },
          {
            provide: getRepositoryToken(PasswordResetToken),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = module.get<PasswordRecoveryService>(PasswordRecoveryService);
      const testUserService = module.get<UserService>(UserService);
      const testPasswordResetTokenRepository = module.get<Repository<PasswordResetToken>>(
        getRepositoryToken(PasswordResetToken),
      );
      const testDomainRepository = module.get<Repository<Domain>>(
        getRepositoryToken(Domain),
      );

      (testUserService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (testPasswordResetTokenRepository.create as jest.Mock).mockReturnValue(mockPasswordResetToken);
      (testPasswordResetTokenRepository.save as jest.Mock).mockResolvedValue(mockPasswordResetToken);
      (testDomainRepository.findOne as jest.Mock).mockResolvedValue(mockDomain);

      // Act
      await testService.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert - verify TTL is 3600 seconds (1 hour)
      const redisCall = testRedisClient.setex.mock.calls[0];
      expect(redisCall[1]).toBe(3600);
    });

    it('should parse "1d" to 86400 seconds', async () => {
      // Arrange
      const testRedisClient = {
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordRecoveryService,
          {
            provide: 'REDIS_CLIENT',
            useValue: testRedisClient,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN') {
                  return '1d';
                }
                return undefined;
              }),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              userRepository: mockUserRepository,
            },
          },
          {
            provide: PasswordService,
            useValue: {
              validatePasswordStrength: jest.fn(),
              hashPassword: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendPasswordResetEmail: jest.fn(),
              isConfigured: true,
            },
          },
          {
            provide: getRepositoryToken(PasswordResetToken),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = module.get<PasswordRecoveryService>(PasswordRecoveryService);
      const testUserService = module.get<UserService>(UserService);
      const testPasswordResetTokenRepository = module.get<Repository<PasswordResetToken>>(
        getRepositoryToken(PasswordResetToken),
      );
      const testDomainRepository = module.get<Repository<Domain>>(
        getRepositoryToken(Domain),
      );

      (testUserService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (testPasswordResetTokenRepository.create as jest.Mock).mockReturnValue(mockPasswordResetToken);
      (testPasswordResetTokenRepository.save as jest.Mock).mockResolvedValue(mockPasswordResetToken);
      (testDomainRepository.findOne as jest.Mock).mockResolvedValue(mockDomain);

      // Act
      await testService.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert - verify TTL is 86400 seconds (1 day)
      const redisCall = testRedisClient.setex.mock.calls[0];
      expect(redisCall[1]).toBe(86400);
    });

    it('should parse "30s" to 30 seconds', async () => {
      // Arrange
      const testRedisClient = {
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordRecoveryService,
          {
            provide: 'REDIS_CLIENT',
            useValue: testRedisClient,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN') {
                  return '30s';
                }
                return undefined;
              }),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              userRepository: mockUserRepository,
            },
          },
          {
            provide: PasswordService,
            useValue: {
              validatePasswordStrength: jest.fn(),
              hashPassword: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendPasswordResetEmail: jest.fn(),
              isConfigured: true,
            },
          },
          {
            provide: getRepositoryToken(PasswordResetToken),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = module.get<PasswordRecoveryService>(PasswordRecoveryService);
      const testUserService = module.get<UserService>(UserService);
      const testPasswordResetTokenRepository = module.get<Repository<PasswordResetToken>>(
        getRepositoryToken(PasswordResetToken),
      );
      const testDomainRepository = module.get<Repository<Domain>>(
        getRepositoryToken(Domain),
      );

      (testUserService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (testPasswordResetTokenRepository.create as jest.Mock).mockReturnValue(mockPasswordResetToken);
      (testPasswordResetTokenRepository.save as jest.Mock).mockResolvedValue(mockPasswordResetToken);
      (testDomainRepository.findOne as jest.Mock).mockResolvedValue(mockDomain);

      // Act
      await testService.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert - verify TTL is 30 seconds
      const redisCall = testRedisClient.setex.mock.calls[0];
      expect(redisCall[1]).toBe(30);
    });

    it('should use default 30 minutes when format is invalid', async () => {
      // Arrange
      const testRedisClient = {
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordRecoveryService,
          {
            provide: 'REDIS_CLIENT',
            useValue: testRedisClient,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN') {
                  return 'invalid-format';
                }
                return undefined;
              }),
            },
          },
          {
            provide: UserService,
            useValue: {
              findByEmail: jest.fn(),
              userRepository: mockUserRepository,
            },
          },
          {
            provide: PasswordService,
            useValue: {
              validatePasswordStrength: jest.fn(),
              hashPassword: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendPasswordResetEmail: jest.fn(),
              isConfigured: true,
            },
          },
          {
            provide: getRepositoryToken(PasswordResetToken),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Domain),
            useValue: {
              findOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = module.get<PasswordRecoveryService>(PasswordRecoveryService);
      const testUserService = module.get<UserService>(UserService);
      const testPasswordResetTokenRepository = module.get<Repository<PasswordResetToken>>(
        getRepositoryToken(PasswordResetToken),
      );
      const testDomainRepository = module.get<Repository<Domain>>(
        getRepositoryToken(Domain),
      );

      (testUserService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (testPasswordResetTokenRepository.create as jest.Mock).mockReturnValue(mockPasswordResetToken);
      (testPasswordResetTokenRepository.save as jest.Mock).mockResolvedValue(mockPasswordResetToken);
      (testDomainRepository.findOne as jest.Mock).mockResolvedValue(mockDomain);

      // Act
      await testService.requestPasswordReset(mockDomainId, mockForgotPasswordDto);

      // Assert - verify TTL is 1800 seconds (30 minutes default)
      const redisCall = testRedisClient.setex.mock.calls[0];
      expect(redisCall[1]).toBe(1800);
    });
  });
});

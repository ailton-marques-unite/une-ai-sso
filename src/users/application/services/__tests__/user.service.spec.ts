import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../user-service/user.service';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { PasswordService } from '../../../../shared/services/password.service';
import { User } from '../../../domain/entities/user.entity';
import { CreateUserDto } from '../../dtos/create-user.dto';
import { UserResponseDto } from '../../dtos/user-response.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<IUserRepository>;
  let passwordService: jest.Mocked<PasswordService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'user@example.com';
  const mockPassword = 'ValidPassword123!@#';
  const mockHashedPassword = 'hashed-password-string';
  const mockFullName = 'Test User';
  const mockPhone = '+5511999999999';

  const mockCreateUserDto: CreateUserDto = {
    email: mockEmail,
    password: mockPassword,
    full_name: mockFullName,
    phone: mockPhone,
  };

  const mockCreateUserDtoMinimal: CreateUserDto = {
    email: mockEmail,
    password: mockPassword,
  };

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: mockEmail,
    password_hash: mockHashedPassword,
    full_name: mockFullName,
    phone: mockPhone,
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
    last_login_at: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as User;

  const mockUserResponse: UserResponseDto = {
    id: mockUserId,
    email: mockEmail,
    full_name: mockFullName,
    phone: mockPhone,
    is_active: true,
    is_verified: false,
    mfa_enabled: false,
    last_login_at: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: 'IUserRepository',
          useValue: {
            existsByEmail: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            updateLastLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            validatePasswordStrength: jest.fn(),
            hashPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get('IUserRepository');
    passwordService = module.get(PasswordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create user when password is valid and email does not exist', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(
        mockPassword,
      );
      expect(userRepository.existsByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(passwordService.hashPassword).toHaveBeenCalledWith(mockPassword);
      expect(userRepository.create).toHaveBeenCalledWith(mockDomainId, {
        email: mockEmail,
        full_name: mockFullName,
        phone: mockPhone,
        password_hash: mockHashedPassword,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should validate password strength before creating', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(
        mockPassword,
      );
      expect(passwordService.validatePasswordStrength).toHaveBeenCalled();
    });

    it('should check if email already exists in domain', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(userRepository.existsByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });

    it('should generate password hash before creating', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(passwordService.hashPassword).toHaveBeenCalledWith(mockPassword);
      expect(passwordService.hashPassword).toHaveBeenCalled();
    });

    it('should remove password field from DTO before creating', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith(
        mockDomainId,
        expect.not.objectContaining({ password: expect.anything() }),
      );
    });

    it('should map password to password_hash in repository', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith(mockDomainId, {
        email: mockEmail,
        full_name: mockFullName,
        phone: mockPhone,
        password_hash: mockHashedPassword,
      });
    });

    it('should return UserResponseDto without password field', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('full_name');
      expect(result).toHaveProperty('phone');
    });

    it('should include all optional fields (full_name, phone) when provided', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(mockDomainId, mockCreateUserDto);

      // Assert
      expect(result.full_name).toBe(mockFullName);
      expect(result.phone).toBe(mockPhone);
      expect(userRepository.create).toHaveBeenCalledWith(mockDomainId, {
        email: mockEmail,
        full_name: mockFullName,
        phone: mockPhone,
        password_hash: mockHashedPassword,
      });
    });

    it('should create user without optional fields when not provided', async () => {
      // Arrange
      const userWithoutOptionalFields = {
        ...mockUser,
        full_name: undefined,
        phone: undefined,
      };
      const userResponseWithoutOptionalFields = {
        ...mockUserResponse,
        full_name: undefined,
        phone: undefined,
      };
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(false);
      passwordService.hashPassword.mockResolvedValue(mockHashedPassword);
      userRepository.create.mockResolvedValue(
        userWithoutOptionalFields as User,
      );

      // Act
      const result = await service.create(
        mockDomainId,
        mockCreateUserDtoMinimal,
      );

      // Assert
      expect(result).toEqual(userResponseWithoutOptionalFields);
      expect(userRepository.create).toHaveBeenCalledWith(mockDomainId, {
        email: mockEmail,
        password_hash: mockHashedPassword,
      });
    });

    it('should throw BadRequestException when password is invalid', async () => {
      // Arrange
      const validationErrors = [
        'A senha deve ter no mínimo 12 caracteres',
        'A senha deve conter pelo menos uma letra maiúscula',
      ];
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      // Act & Assert
      await expect(
        service.create(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(validationErrors.join(', '));

      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(
        mockPassword,
      );
      expect(userRepository.existsByEmail).not.toHaveBeenCalled();
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with password validation error messages', async () => {
      // Arrange
      const validationErrors = [
        'A senha deve ter no mínimo 12 caracteres',
        'A senha deve conter pelo menos uma letra minúscula',
        'A senha deve conter pelo menos um número',
        'A senha deve conter pelo menos um caractere especial (@$!%*?&)',
      ];
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      // Act & Assert
      await expect(
        service.create(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(validationErrors.join(', '));
    });

    it('should throw ConflictException when email already exists in domain', async () => {
      // Arrange
      passwordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      userRepository.existsByEmail.mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.create(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(mockDomainId, mockCreateUserDto),
      ).rejects.toThrow(
        'This email address is already in use on this domain.',
      );

      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(
        mockPassword,
      );
      expect(userRepository.existsByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return UserResponseDto when user is found', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(mockDomainId, mockUserId);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(userRepository.findById).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should search user by correct ID and domainId', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser);

      // Act
      await service.findById(mockDomainId, mockUserId);

      // Assert
      expect(userRepository.findById).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should convert User to UserResponseDto correctly (without password_hash)', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(mockDomainId, mockUserId);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(result).not.toHaveProperty('password_hash');
      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.full_name).toBe(mockUser.full_name);
      expect(result.phone).toBe(mockUser.phone);
      expect(result.is_active).toBe(mockUser.is_active);
      expect(result.is_verified).toBe(mockUser.is_verified);
      expect(result.mfa_enabled).toBe(mockUser.mfa_enabled);
      expect(result.last_login_at).toBe(mockUser.last_login_at);
      expect(result.created_at).toBe(mockUser.created_at);
      expect(result.updated_at).toBe(mockUser.updated_at);
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findById(mockDomainId, mockUserId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById(mockDomainId, mockUserId),
      ).rejects.toThrow('User not found');

      expect(userRepository.findById).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return User when user is found', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmail(mockDomainId, mockEmail);

      // Assert
      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });

    it('should return null when user is not found', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail(mockDomainId, mockEmail);

      // Assert
      expect(result).toBeNull();
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });

    it('should search user by correct email and domainId', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(mockUser);

      // Act
      await service.findByEmail(mockDomainId, mockEmail);

      // Assert
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        mockDomainId,
        mockEmail,
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login', async () => {
      // Arrange
      userRepository.updateLastLogin.mockResolvedValue(undefined);

      // Act
      await service.updateLastLogin(mockDomainId, mockUserId);

      // Assert
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should call repository with correct domainId and userId', async () => {
      // Arrange
      userRepository.updateLastLogin.mockResolvedValue(undefined);

      // Act
      await service.updateLastLogin(mockDomainId, mockUserId);

      // Assert
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should return resolved Promise<void>', async () => {
      // Arrange
      userRepository.updateLastLogin.mockResolvedValue(undefined);

      // Act
      const result = await service.updateLastLogin(mockDomainId, mockUserId);

      // Assert
      expect(result).toBeUndefined();
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });
  });
});

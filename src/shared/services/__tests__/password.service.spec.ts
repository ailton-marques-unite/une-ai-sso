import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../password.service';
import { APP_LOGGER } from '../../utils/logger';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
const mockHash = jest.fn();
const mockCompare = jest.fn();

jest.mock('bcrypt', () => ({
  hash: (...args: any[]) => mockHash(...args),
  compare: (...args: any[]) => mockCompare(...args),
}));

describe('PasswordService', () => {
  let service: PasswordService;
  let configService: jest.Mocked<ConfigService>;

  // Test data
  const mockPassword = 'ValidPassword123!@#';
  const mockHashedPassword = '$2b$10$hashedpasswordstring';
  const mockBcryptRounds = '12';
  const mockBcryptRoundsNumber = 12;
  const defaultBcryptRounds = 10;

  const validPassword = 'ValidPassword123!@#';
  const shortPassword = 'Short1!';
  const noLowercasePassword = 'VALIDPASSWORD123!@#';
  const noUppercasePassword = 'validpassword123!@#';
  const noNumberPassword = 'ValidPassword!@#';
  const noSpecialCharPassword = 'ValidPassword123';
  const multipleIssuesPassword = 'short';

  beforeEach(async () => {
    // Reset mocks
    mockHash.mockResolvedValue(mockHashedPassword);
    mockCompare.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'BCRYPT_ROUNDS') {
                return mockBcryptRounds;
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: APP_LOGGER,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should configure saltRounds with BCRYPT_ROUNDS from ConfigService when defined', async () => {
      // Arrange & Act - já configurado no beforeEach com mockBcryptRounds

      // Assert
      expect(configService.get).toHaveBeenCalledWith('BCRYPT_ROUNDS', '10');
    });

    it('should configure saltRounds with default value 10 when BCRYPT_ROUNDS is not defined', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'BCRYPT_ROUNDS') {
                  return defaultValue;
                }
                return defaultValue;
              }),
            },
          },
          {
            provide: APP_LOGGER,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
          },
        ],
      }).compile();

      const testService = module.get<PasswordService>(PasswordService);

      // Act
      await testService.hashPassword(mockPassword);

      // Assert
      expect(mockHash).toHaveBeenCalledWith(
        mockPassword,
        defaultBcryptRounds,
      );
    });

    it('should convert BCRYPT_ROUNDS to number using parseInt', async () => {
      // Arrange & Act - já configurado no beforeEach

      // Act
      await service.hashPassword(mockPassword);

      // Assert
      expect(mockHash).toHaveBeenCalledWith(
        mockPassword,
        mockBcryptRoundsNumber,
      );
    });
  });

  describe('hashPassword', () => {
    it('should generate password hash using bcrypt.hash', async () => {
      // Arrange
      mockHash.mockResolvedValue(mockHashedPassword);

      // Act
      const result = await service.hashPassword(mockPassword);

      // Assert
      expect(result).toBe(mockHashedPassword);
      expect(mockHash).toHaveBeenCalled();
    });

    it('should call bcrypt.hash with password and correct saltRounds', async () => {
      // Arrange
      mockHash.mockResolvedValue(mockHashedPassword);

      // Act
      await service.hashPassword(mockPassword);

      // Assert
      expect(mockHash).toHaveBeenCalledWith(
        mockPassword,
        mockBcryptRoundsNumber,
      );
    });

    it('should return hash string when successful', async () => {
      // Arrange
      mockHash.mockResolvedValue(mockHashedPassword);

      // Act
      const result = await service.hashPassword(mockPassword);

      // Assert
      expect(result).toBe(mockHashedPassword);
      expect(typeof result).toBe('string');
    });

    it('should use saltRounds configured in constructor', async () => {
      // Arrange
      mockHash.mockResolvedValue(mockHashedPassword);

      // Act
      await service.hashPassword(mockPassword);

      // Assert
      expect(mockHash).toHaveBeenCalledWith(
        mockPassword,
        mockBcryptRoundsNumber,
      );
    });
  });

  describe('comparePassword', () => {
    it('should compare password with hash using bcrypt.compare', async () => {
      // Arrange
      mockCompare.mockResolvedValue(true);

      // Act
      const result = await service.comparePassword(mockPassword, mockHashedPassword);

      // Assert
      expect(result).toBe(true);
      expect(mockCompare).toHaveBeenCalled();
    });

    it('should call bcrypt.compare with password and hashedPassword', async () => {
      // Arrange
      mockCompare.mockResolvedValue(true);

      // Act
      await service.comparePassword(mockPassword, mockHashedPassword);

      // Assert
      expect(mockCompare).toHaveBeenCalledWith(
        mockPassword,
        mockHashedPassword,
      );
    });

    it('should return true when password matches hash', async () => {
      // Arrange
      mockCompare.mockResolvedValue(true);

      // Act
      const result = await service.comparePassword(mockPassword, mockHashedPassword);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when password does not match hash', async () => {
      // Arrange
      mockCompare.mockResolvedValue(false);

      // Act
      const result = await service.comparePassword(mockPassword, mockHashedPassword);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should return isValid: true when password meets all criteria', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(validPassword);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors: [] when password is valid', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(validPassword);

      // Assert
      expect(result.errors).toEqual([]);
      expect(result.errors.length).toBe(0);
    });

    it('should return isValid: false when password does not meet criteria', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(shortPassword);

      // Assert
      expect(result.isValid).toBe(false);
    });

    it('should return errors with messages when password is invalid', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(shortPassword);

      // Assert
      expect(result.errors.length).toBeGreaterThan(0);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should validate minimum length of 12 characters', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(shortPassword);

      // Assert
      expect(result.errors).toContain('A senha deve ter no mínimo 12 caracteres');
    });

    it('should return error when password has less than 12 characters', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(shortPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A senha deve ter no mínimo 12 caracteres');
    });

    it('should return error with correct message when password is too short', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(shortPassword);

      // Assert
      expect(result.errors).toContain('A senha deve ter no mínimo 12 caracteres');
    });

    it('should validate presence of lowercase letter', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noLowercasePassword);

      // Assert
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra minúscula');
    });

    it('should return error when password does not contain lowercase letter', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noLowercasePassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra minúscula');
    });

    it('should return error with correct message when lowercase letter is missing', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noLowercasePassword);

      // Assert
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra minúscula');
    });

    it('should validate presence of uppercase letter', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noUppercasePassword);

      // Assert
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra maiúscula');
    });

    it('should return error when password does not contain uppercase letter', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noUppercasePassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra maiúscula');
    });

    it('should return error with correct message when uppercase letter is missing', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noUppercasePassword);

      // Assert
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra maiúscula');
    });

    it('should validate presence of number', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noNumberPassword);

      // Assert
      expect(result.errors).toContain('A senha deve conter pelo menos um número');
    });

    it('should return error when password does not contain number', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noNumberPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A senha deve conter pelo menos um número');
    });

    it('should return error with correct message when number is missing', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noNumberPassword);

      // Assert
      expect(result.errors).toContain('A senha deve conter pelo menos um número');
    });

    it('should validate presence of special character (@$!%*?&)', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noSpecialCharPassword);

      // Assert
      expect(result.errors).toContain(
        'A senha deve conter pelo menos um caractere especial (@$!%*?&)',
      );
    });

    it('should return error when password does not contain special character', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noSpecialCharPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'A senha deve conter pelo menos um caractere especial (@$!%*?&)',
      );
    });

    it('should return error with correct message when special character is missing', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(noSpecialCharPassword);

      // Assert
      expect(result.errors).toContain(
        'A senha deve conter pelo menos um caractere especial (@$!%*?&)',
      );
    });

    it('should return multiple errors when password fails multiple criteria', () => {
      // Arrange & Act
      const result = service.validatePasswordStrength(multipleIssuesPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('A senha deve ter no mínimo 12 caracteres');
      expect(result.errors).toContain('A senha deve conter pelo menos uma letra maiúscula');
      expect(result.errors).toContain('A senha deve conter pelo menos um número');
      expect(result.errors).toContain(
        'A senha deve conter pelo menos um caractere especial (@$!%*?&)',
      );
    });
  });
});

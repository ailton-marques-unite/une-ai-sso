import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PasswordRecoveryController } from '../password-recovery.controller';
import { PasswordRecoveryService } from '../../../application/services/password-recovery-service/password-recovery.service';
import { ForgotPasswordDto } from '../../../application/dtos/forgot-password.dto';
import { ResetPasswordDto } from '../../../application/dtos/reset-password.dto';

describe('PasswordRecoveryController', () => {
  let controller: PasswordRecoveryController;
  let passwordRecoveryService: jest.Mocked<PasswordRecoveryService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockEmail = 'user@example.com';
  const mockToken = 'reset-token-string';
  const mockNewPassword = 'NewPassword123!@#';

  const mockForgotPasswordDto: ForgotPasswordDto = {
    email: mockEmail,
  };

  const mockResetPasswordDto: ResetPasswordDto = {
    token: mockToken,
    new_password: mockNewPassword,
  };

  const mockRequestWithDomainContext = {
    domainContext: {
      domainId: mockDomainId,
    },
  };

  const mockRequestEmpty = {};

  const mockRequestPasswordResetResponse = {
    success: true,
    message: 'Se o email existir, um link de recuperação será enviado',
  };

  const mockResetPasswordResponse = {
    success: true,
    message: 'Password reset successfully',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordRecoveryController],
      providers: [
        {
          provide: PasswordRecoveryService,
          useValue: {
            requestPasswordReset: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PasswordRecoveryController>(PasswordRecoveryController);
    passwordRecoveryService = module.get(PasswordRecoveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('should request password reset when domainContext is present', async () => {
      // Arrange
      passwordRecoveryService.requestPasswordReset.mockResolvedValue(
        mockRequestPasswordResetResponse,
      );

      // Act
      const result = await controller.forgotPassword(
        mockForgotPasswordDto,
        mockRequestWithDomainContext as any,
      );

      // Assert
      expect(result).toEqual(mockRequestPasswordResetResponse);
      expect(passwordRecoveryService.requestPasswordReset).toHaveBeenCalledWith(
        mockDomainId,
        mockForgotPasswordDto,
      );
      expect(passwordRecoveryService.requestPasswordReset).toHaveBeenCalledTimes(1);
    });

    it('should call passwordRecoveryService.requestPasswordReset with correct domainId and forgotPasswordDto', async () => {
      // Arrange
      passwordRecoveryService.requestPasswordReset.mockResolvedValue(
        mockRequestPasswordResetResponse,
      );

      // Act
      await controller.forgotPassword(
        mockForgotPasswordDto,
        mockRequestWithDomainContext as any,
      );

      // Assert
      expect(passwordRecoveryService.requestPasswordReset).toHaveBeenCalledWith(
        mockDomainId,
        mockForgotPasswordDto,
      );
    });

    it('should return object with success: true and message', async () => {
      // Arrange
      passwordRecoveryService.requestPasswordReset.mockResolvedValue(
        mockRequestPasswordResetResponse,
      );

      // Act
      const result = await controller.forgotPassword(
        mockForgotPasswordDto,
        mockRequestWithDomainContext as any,
      );

      // Assert
      expect(result).toEqual(mockRequestPasswordResetResponse);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result.success).toBe(true);
      expect(result.message).toBeTruthy();
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.forgotPassword(mockForgotPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.forgotPassword(mockForgotPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required');

      expect(passwordRecoveryService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context is required"', async () => {
      // Act & Assert
      await expect(
        controller.forgotPassword(mockForgotPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.forgotPassword(mockForgotPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required');
    });

    it('should propagate PasswordRecoveryService errors', async () => {
      // Arrange
      const serviceError = new Error('Service error');
      passwordRecoveryService.requestPasswordReset.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.forgotPassword(
          mockForgotPasswordDto,
          mockRequestWithDomainContext as any,
        ),
      ).rejects.toThrow('Service error');
    });
  });

  describe('resetPassword', () => {
    it('should reset password when domainContext is present', async () => {
      // Arrange
      passwordRecoveryService.resetPassword.mockResolvedValue(mockResetPasswordResponse);

      // Act
      const result = await controller.resetPassword(
        mockResetPasswordDto,
        mockRequestWithDomainContext as any,
      );

      // Assert
      expect(result).toEqual(mockResetPasswordResponse);
      expect(passwordRecoveryService.resetPassword).toHaveBeenCalledWith(
        mockDomainId,
        mockResetPasswordDto,
      );
      expect(passwordRecoveryService.resetPassword).toHaveBeenCalledTimes(1);
    });

    it('should call passwordRecoveryService.resetPassword with correct domainId and resetPasswordDto', async () => {
      // Arrange
      passwordRecoveryService.resetPassword.mockResolvedValue(mockResetPasswordResponse);

      // Act
      await controller.resetPassword(
        mockResetPasswordDto,
        mockRequestWithDomainContext as any,
      );

      // Assert
      expect(passwordRecoveryService.resetPassword).toHaveBeenCalledWith(
        mockDomainId,
        mockResetPasswordDto,
      );
    });

    it('should return object with success: true and message', async () => {
      // Arrange
      passwordRecoveryService.resetPassword.mockResolvedValue(mockResetPasswordResponse);

      // Act
      const result = await controller.resetPassword(
        mockResetPasswordDto,
        mockRequestWithDomainContext as any,
      );

      // Assert
      expect(result).toEqual(mockResetPasswordResponse);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result.success).toBe(true);
      expect(result.message).toBeTruthy();
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.resetPassword(mockResetPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.resetPassword(mockResetPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required');

      expect(passwordRecoveryService.resetPassword).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context is required"', async () => {
      // Act & Assert
      await expect(
        controller.resetPassword(mockResetPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.resetPassword(mockResetPasswordDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required');
    });

    it('should propagate PasswordRecoveryService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Invalid or expired token');
      passwordRecoveryService.resetPassword.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(
        controller.resetPassword(
          mockResetPasswordDto,
          mockRequestWithDomainContext as any,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.resetPassword(
          mockResetPasswordDto,
          mockRequestWithDomainContext as any,
        ),
      ).rejects.toThrow('Invalid or expired token');
    });

    it('should propagate PasswordRecoveryService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('Token not found');
      passwordRecoveryService.resetPassword.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.resetPassword(
          mockResetPasswordDto,
          mockRequestWithDomainContext as any,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.resetPassword(
          mockResetPasswordDto,
          mockRequestWithDomainContext as any,
        ),
      ).rejects.toThrow('Token not found');
    });
  });
});

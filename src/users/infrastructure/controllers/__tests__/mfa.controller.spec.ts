import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MfaController } from '../mfa.controller';
import { MfaService } from '../../../application/services/mfa-service/mfa.service';
import { MfaSetupDto } from '../../../application/dtos/mfa-setup.dto';
import { MfaVerifyDto } from '../../../application/dtos/mfa-verify.dto';
import { MfaType } from '../../../domain/entities/user-mfa.entity';

describe('MfaController', () => {
  let controller: MfaController;
  let mfaService: jest.Mocked<MfaService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockMfaCode = '123456';
  const mockSecret = 'JBSWY3DPEHPK3PXP';
  const mockQrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const mockBackupCodes = ['12345678', '87654321', '11223344', '44332211', '55667788'];

  const mockMfaSetupDto: MfaSetupDto = {
    method: MfaType.TOTP,
  };

  const mockMfaSetupDtoWithoutMethod: MfaSetupDto = {};

  const mockMfaVerifyDto: MfaVerifyDto = {
    code: mockMfaCode,
    method: MfaType.TOTP,
  };

  const mockMfaVerifyDtoWithoutMethod: MfaVerifyDto = {
    code: mockMfaCode,
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

  const mockRequestWithoutDomain = {
    user: {
      sub: mockUserId,
    },
  };

  const mockRequestWithoutUser = {
    domainContext: {
      domainId: mockDomainId,
    },
  };

  const mockSetupResponse = {
    secret: mockSecret,
    qr_code: mockQrCode,
    backup_codes: mockBackupCodes,
  };

  const mockSendMfaCodeResponse = {
    code: mockMfaCode,
    expiresIn: 300,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MfaController],
      providers: [
        {
          provide: MfaService,
          useValue: {
            setupMfa: jest.fn(),
            enableMfa: jest.fn().mockResolvedValue(undefined),
            disableMfa: jest.fn().mockResolvedValue(undefined),
            generateBackupCodes: jest.fn(),
            sendMfaCode: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MfaController>(MfaController);
    mfaService = module.get(MfaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupMfa', () => {
    it('should setup MFA when domainContext and user are present', async () => {
      // Arrange
      mfaService.setupMfa.mockResolvedValue(mockSetupResponse);

      // Act
      const result = await controller.setupMfa(mockMfaSetupDto, mockRequestWithUser as any);

      // Assert
      expect(result).toEqual(mockSetupResponse);
      expect(mfaService.setupMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.TOTP,
      );
      expect(mfaService.setupMfa).toHaveBeenCalledTimes(1);
    });

    it('should call mfaService.setupMfa with correct domainId, userId and method', async () => {
      // Arrange
      mfaService.setupMfa.mockResolvedValue(mockSetupResponse);

      // Act
      await controller.setupMfa(mockMfaSetupDto, mockRequestWithUser as any);

      // Assert
      expect(mfaService.setupMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.TOTP,
      );
    });

    it('should use MfaType.TOTP as default when method is not provided', async () => {
      // Arrange
      mfaService.setupMfa.mockResolvedValue(mockSetupResponse);

      // Act
      await controller.setupMfa(mockMfaSetupDtoWithoutMethod, mockRequestWithUser as any);

      // Assert
      expect(mfaService.setupMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.TOTP,
      );
    });

    it('should use method provided in DTO when present', async () => {
      // Arrange
      const setupDtoWithSms: MfaSetupDto = { method: MfaType.SMS };
      mfaService.setupMfa.mockResolvedValue(mockSetupResponse);

      // Act
      await controller.setupMfa(setupDtoWithSms, mockRequestWithUser as any);

      // Assert
      expect(mfaService.setupMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.SMS,
      );
    });

    it('should return object with secret, qr_code and backup_codes', async () => {
      // Arrange
      mfaService.setupMfa.mockResolvedValue(mockSetupResponse);

      // Act
      const result = await controller.setupMfa(mockMfaSetupDto, mockRequestWithUser as any);

      // Assert
      expect(result).toEqual(mockSetupResponse);
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qr_code');
      expect(result).toHaveProperty('backup_codes');
      expect(result.backup_codes).toBeInstanceOf(Array);
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.setupMfa).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Act & Assert
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.setupMfa).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate MfaService errors', async () => {
      // Arrange
      const serviceError = new Error('Service error');
      mfaService.setupMfa.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.setupMfa(mockMfaSetupDto, mockRequestWithUser as any),
      ).rejects.toThrow('Service error');
    });
  });

  describe('verifyMfa', () => {
    it('should verify MFA code when domainContext and user are present', async () => {
      // Arrange
      mfaService.enableMfa.mockResolvedValue(undefined);

      // Act
      const result = await controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'MFA enabled successfully',
      });
      expect(mfaService.enableMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockMfaCode,
        MfaType.TOTP,
      );
      expect(mfaService.enableMfa).toHaveBeenCalledTimes(1);
    });

    it('should call mfaService.enableMfa with correct domainId, userId, code and method', async () => {
      // Arrange
      mfaService.enableMfa.mockResolvedValue(undefined);

      // Act
      await controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any);

      // Assert
      expect(mfaService.enableMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockMfaCode,
        MfaType.TOTP,
      );
    });

    it('should use MfaType.TOTP as default when method is not provided', async () => {
      // Arrange
      mfaService.enableMfa.mockResolvedValue(undefined);

      // Act
      await controller.verifyMfa(mockMfaVerifyDtoWithoutMethod, mockRequestWithUser as any);

      // Assert
      expect(mfaService.enableMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockMfaCode,
        MfaType.TOTP,
      );
    });

    it('should use method provided in DTO when present', async () => {
      // Arrange
      const verifyDtoWithSms: MfaVerifyDto = { code: mockMfaCode, method: MfaType.SMS };
      mfaService.enableMfa.mockResolvedValue(undefined);

      // Act
      await controller.verifyMfa(verifyDtoWithSms, mockRequestWithUser as any);

      // Assert
      expect(mfaService.enableMfa).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockMfaCode,
        MfaType.SMS,
      );
    });

    it('should return object with success: true and message: "MFA enabled successfully"', async () => {
      // Arrange
      mfaService.enableMfa.mockResolvedValue(undefined);

      // Act
      const result = await controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'MFA enabled successfully',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('MFA enabled successfully');
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.enableMfa).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Act & Assert
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.enableMfa).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate MfaService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Verification code invalid');
      mfaService.enableMfa.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any),
      ).rejects.toThrow('Verification code invalid');
    });

    it('should propagate MfaService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('MFA not configured');
      mfaService.enableMfa.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.verifyMfa(mockMfaVerifyDto, mockRequestWithUser as any),
      ).rejects.toThrow('MFA not configured');
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA when domainContext and user are present', async () => {
      // Arrange
      mfaService.disableMfa.mockResolvedValue(undefined);

      // Act
      const result = await controller.disableMfa(mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'MFA disabled successfully',
      });
      expect(mfaService.disableMfa).toHaveBeenCalledWith(mockDomainId, mockUserId);
      expect(mfaService.disableMfa).toHaveBeenCalledTimes(1);
    });

    it('should call mfaService.disableMfa with correct domainId and userId', async () => {
      // Arrange
      mfaService.disableMfa.mockResolvedValue(undefined);

      // Act
      await controller.disableMfa(mockRequestWithUser as any);

      // Assert
      expect(mfaService.disableMfa).toHaveBeenCalledWith(mockDomainId, mockUserId);
    });

    it('should return object with success: true and message: "MFA disabled successfully"', async () => {
      // Arrange
      mfaService.disableMfa.mockResolvedValue(undefined);

      // Act
      const result = await controller.disableMfa(mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'MFA disabled successfully',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('MFA disabled successfully');
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.disableMfa(mockRequestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.disableMfa(mockRequestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.disableMfa).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Act & Assert
      await expect(
        controller.disableMfa(mockRequestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.disableMfa(mockRequestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.disableMfa).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.disableMfa(mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.disableMfa(mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate MfaService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('User not found');
      mfaService.disableMfa.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.disableMfa(mockRequestWithUser as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.disableMfa(mockRequestWithUser as any),
      ).rejects.toThrow('User not found');
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate backup codes when domainContext and user are present', async () => {
      // Arrange
      mfaService.generateBackupCodes.mockResolvedValue(mockBackupCodes);

      // Act
      const result = await controller.generateBackupCodes(mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({ backup_codes: mockBackupCodes });
      expect(mfaService.generateBackupCodes).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(mfaService.generateBackupCodes).toHaveBeenCalledTimes(1);
    });

    it('should call mfaService.generateBackupCodes with correct domainId and userId', async () => {
      // Arrange
      mfaService.generateBackupCodes.mockResolvedValue(mockBackupCodes);

      // Act
      await controller.generateBackupCodes(mockRequestWithUser as any);

      // Assert
      expect(mfaService.generateBackupCodes).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should return object with backup_codes array', async () => {
      // Arrange
      mfaService.generateBackupCodes.mockResolvedValue(mockBackupCodes);

      // Act
      const result = await controller.generateBackupCodes(mockRequestWithUser as any);

      // Assert
      expect(result).toEqual({ backup_codes: mockBackupCodes });
      expect(result).toHaveProperty('backup_codes');
      expect(result.backup_codes).toBeInstanceOf(Array);
      expect(result.backup_codes.length).toBeGreaterThan(0);
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.generateBackupCodes(mockRequestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.generateBackupCodes(mockRequestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.generateBackupCodes).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Act & Assert
      await expect(
        controller.generateBackupCodes(mockRequestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.generateBackupCodes(mockRequestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.generateBackupCodes).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.generateBackupCodes(mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.generateBackupCodes(mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate MfaService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('MFA is not enabled');
      mfaService.generateBackupCodes.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.generateBackupCodes(mockRequestWithUser as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.generateBackupCodes(mockRequestWithUser as any),
      ).rejects.toThrow('MFA is not enabled');
    });
  });

  describe('sendMfaCode', () => {
    it('should send MFA code when domainContext and user are present', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      const result = await controller.sendMfaCode(
        { method: MfaType.SMS },
        mockRequestWithUser as any,
      );

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Code sent via sms',
        expiresIn: 300,
      });
      expect(mfaService.sendMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.SMS,
      );
      expect(mfaService.sendMfaCode).toHaveBeenCalledTimes(1);
    });

    it('should call mfaService.sendMfaCode with correct domainId, userId and method', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      await controller.sendMfaCode({ method: MfaType.EMAIL }, mockRequestWithUser as any);

      // Assert
      expect(mfaService.sendMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.EMAIL,
      );
    });

    it('should return object with success: true, message and expiresIn', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      const result = await controller.sendMfaCode(
        { method: MfaType.SMS },
        mockRequestWithUser as any,
      );

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Code sent via sms',
        expiresIn: 300,
      });
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should return message with method used (sms)', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      const result = await controller.sendMfaCode(
        { method: MfaType.SMS },
        mockRequestWithUser as any,
      );

      // Assert
      expect(result.message).toBe('Code sent via sms');
    });

    it('should return message with method used (email)', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      const result = await controller.sendMfaCode(
        { method: MfaType.EMAIL },
        mockRequestWithUser as any,
      );

      // Assert
      expect(result.message).toBe('Code sent via email');
    });

    it('should work with method SMS', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      await controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithUser as any);

      // Assert
      expect(mfaService.sendMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.SMS,
      );
    });

    it('should work with method EMAIL', async () => {
      // Arrange
      mfaService.sendMfaCode.mockResolvedValue(mockSendMfaCodeResponse);

      // Act
      await controller.sendMfaCode({ method: MfaType.EMAIL }, mockRequestWithUser as any);

      // Assert
      expect(mfaService.sendMfaCode).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        MfaType.EMAIL,
      );
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.sendMfaCode).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Act & Assert
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(mfaService.sendMfaCode).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate MfaService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Phone not registered');
      mfaService.sendMfaCode.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithUser as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.sendMfaCode({ method: MfaType.SMS }, mockRequestWithUser as any),
      ).rejects.toThrow('Phone not registered');
    });

    it('should propagate MfaService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('User not found');
      mfaService.sendMfaCode.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.sendMfaCode({ method: MfaType.EMAIL }, mockRequestWithUser as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.sendMfaCode({ method: MfaType.EMAIL }, mockRequestWithUser as any),
      ).rejects.toThrow('User not found');
    });
  });
});

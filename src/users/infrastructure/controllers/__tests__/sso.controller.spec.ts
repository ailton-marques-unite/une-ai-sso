import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { SsoController } from '../sso.controller';
import { SsoService } from '../../../application/services/sso-service/sso.service';

describe('SsoController', () => {
  let controller: SsoController;
  let ssoService: jest.Mocked<SsoService>;
  let mockResponse: jest.Mocked<Response>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockCode = 'authorization-code-string';
  const mockState = 'a'.repeat(64); // 64 hex characters
  const mockAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=test';
  const mockAccessToken = 'jwt-access-token';
  const mockRefreshToken = 'jwt-refresh-token';

  const mockInitiateOAuthResponse = {
    authUrl: mockAuthUrl,
    state: mockState,
  };

  const mockHandleCallbackResponse = {
    access_token: mockAccessToken,
    refresh_token: mockRefreshToken,
    expires_in: 3600,
    token_type: 'Bearer',
  };

  beforeEach(async () => {
    // Mock Express Response
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SsoController],
      providers: [
        {
          provide: SsoService,
          useValue: {
            initiateGoogleOAuth: jest.fn(),
            handleGoogleCallback: jest.fn(),
            initiateMicrosoftOAuth: jest.fn(),
            handleMicrosoftCallback: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SsoController>(SsoController);
    ssoService = module.get(SsoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateGoogleOAuth', () => {
    it('should initiate Google OAuth when domainId is provided', async () => {
      // Arrange
      ssoService.initiateGoogleOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      const result = await controller.initiateGoogleOAuth(mockDomainId);

      // Assert
      expect(result).toEqual(mockInitiateOAuthResponse);
      expect(ssoService.initiateGoogleOAuth).toHaveBeenCalledWith(mockDomainId);
      expect(ssoService.initiateGoogleOAuth).toHaveBeenCalledTimes(1);
    });

    it('should initiate Google OAuth when domainId is not provided', async () => {
      // Arrange
      ssoService.initiateGoogleOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      const result = await controller.initiateGoogleOAuth(undefined);

      // Assert
      expect(result).toEqual(mockInitiateOAuthResponse);
      expect(ssoService.initiateGoogleOAuth).toHaveBeenCalledWith(undefined);
    });

    it('should call ssoService.initiateGoogleOAuth with correct domainId', async () => {
      // Arrange
      ssoService.initiateGoogleOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      await controller.initiateGoogleOAuth(mockDomainId);

      // Assert
      expect(ssoService.initiateGoogleOAuth).toHaveBeenCalledWith(mockDomainId);
    });

    it('should return object with authUrl and state', async () => {
      // Arrange
      ssoService.initiateGoogleOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      const result = await controller.initiateGoogleOAuth(mockDomainId);

      // Assert
      expect(result).toEqual(mockInitiateOAuthResponse);
      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toBe(mockAuthUrl);
      expect(result.state).toBe(mockState);
    });

    it('should propagate SsoService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Google OAuth not configured');
      ssoService.initiateGoogleOAuth.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(controller.initiateGoogleOAuth(mockDomainId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.initiateGoogleOAuth(mockDomainId)).rejects.toThrow(
        'Google OAuth not configured',
      );
    });
  });

  describe('handleGoogleCallback', () => {
    it('should process Google callback when code and state are valid', async () => {
      // Arrange
      ssoService.handleGoogleCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleGoogleCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(ssoService.handleGoogleCallback).toHaveBeenCalledWith(mockCode, mockState);
      expect(ssoService.handleGoogleCallback).toHaveBeenCalledTimes(1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        ...mockHandleCallbackResponse,
        message: 'Google authentication successful',
      });
    });

    it('should call ssoService.handleGoogleCallback with correct code and state', async () => {
      // Arrange
      ssoService.handleGoogleCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleGoogleCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(ssoService.handleGoogleCallback).toHaveBeenCalledWith(mockCode, mockState);
    });

    it('should call res.json with object containing success: true, tokens and message', async () => {
      // Arrange
      ssoService.handleGoogleCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleGoogleCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
        message: 'Google authentication successful',
      });
    });

    it('should return message "Google authentication successful"', async () => {
      // Arrange
      ssoService.handleGoogleCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleGoogleCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Google authentication successful',
        }),
      );
    });

    it('should propagate SsoService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('State invalid or expired');
      ssoService.handleGoogleCallback.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(
        controller.handleGoogleCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.handleGoogleCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow('State invalid or expired');

      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should propagate SsoService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('Domain not found');
      ssoService.handleGoogleCallback.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.handleGoogleCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.handleGoogleCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow('Domain not found');

      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('initiateMicrosoftOAuth', () => {
    it('should initiate Microsoft OAuth when domainId is provided', async () => {
      // Arrange
      ssoService.initiateMicrosoftOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      const result = await controller.initiateMicrosoftOAuth(mockDomainId);

      // Assert
      expect(result).toEqual(mockInitiateOAuthResponse);
      expect(ssoService.initiateMicrosoftOAuth).toHaveBeenCalledWith(mockDomainId);
      expect(ssoService.initiateMicrosoftOAuth).toHaveBeenCalledTimes(1);
    });

    it('should initiate Microsoft OAuth when domainId is not provided', async () => {
      // Arrange
      ssoService.initiateMicrosoftOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      const result = await controller.initiateMicrosoftOAuth(undefined);

      // Assert
      expect(result).toEqual(mockInitiateOAuthResponse);
      expect(ssoService.initiateMicrosoftOAuth).toHaveBeenCalledWith(undefined);
    });

    it('should call ssoService.initiateMicrosoftOAuth with correct domainId', async () => {
      // Arrange
      ssoService.initiateMicrosoftOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      await controller.initiateMicrosoftOAuth(mockDomainId);

      // Assert
      expect(ssoService.initiateMicrosoftOAuth).toHaveBeenCalledWith(mockDomainId);
    });

    it('should return object with authUrl and state', async () => {
      // Arrange
      ssoService.initiateMicrosoftOAuth.mockResolvedValue(mockInitiateOAuthResponse);

      // Act
      const result = await controller.initiateMicrosoftOAuth(mockDomainId);

      // Assert
      expect(result).toEqual(mockInitiateOAuthResponse);
      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toBe(mockAuthUrl);
      expect(result.state).toBe(mockState);
    });

    it('should propagate SsoService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Microsoft OAuth not configured');
      ssoService.initiateMicrosoftOAuth.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(controller.initiateMicrosoftOAuth(mockDomainId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.initiateMicrosoftOAuth(mockDomainId)).rejects.toThrow(
        'Microsoft OAuth not configured',
      );
    });
  });

  describe('handleMicrosoftCallback', () => {
    it('should process Microsoft callback when code and state are valid', async () => {
      // Arrange
      ssoService.handleMicrosoftCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleMicrosoftCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(ssoService.handleMicrosoftCallback).toHaveBeenCalledWith(mockCode, mockState);
      expect(ssoService.handleMicrosoftCallback).toHaveBeenCalledTimes(1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        ...mockHandleCallbackResponse,
        message: 'Microsoft authentication successful',
      });
    });

    it('should call ssoService.handleMicrosoftCallback with correct code and state', async () => {
      // Arrange
      ssoService.handleMicrosoftCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleMicrosoftCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(ssoService.handleMicrosoftCallback).toHaveBeenCalledWith(mockCode, mockState);
    });

    it('should call res.json with object containing success: true, tokens and message', async () => {
      // Arrange
      ssoService.handleMicrosoftCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleMicrosoftCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
        message: 'Microsoft authentication successful',
      });
    });

    it('should return message "Microsoft authentication successful"', async () => {
      // Arrange
      ssoService.handleMicrosoftCallback.mockResolvedValue(mockHandleCallbackResponse);

      // Act
      await controller.handleMicrosoftCallback(mockCode, mockState, mockResponse);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Microsoft authentication successful',
        }),
      );
    });

    it('should propagate SsoService errors (BadRequestException)', async () => {
      // Arrange
      const badRequestError = new BadRequestException('State invalid or expired');
      ssoService.handleMicrosoftCallback.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(
        controller.handleMicrosoftCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.handleMicrosoftCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow('State invalid or expired');

      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should propagate SsoService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('Domain not found');
      ssoService.handleMicrosoftCallback.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.handleMicrosoftCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.handleMicrosoftCallback(mockCode, mockState, mockResponse),
      ).rejects.toThrow('Domain not found');

      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});

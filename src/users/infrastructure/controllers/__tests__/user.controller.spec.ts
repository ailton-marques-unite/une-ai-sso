import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserController } from '../user.controller';
import { UserService } from '../../../application/services/user-service/user.service';
import { RbacService } from '../../../application/services/rbac-service/rbac.service';
import { UserResponseDto } from '../../../application/dtos/user-response.dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;
  let rbacService: jest.Mocked<RbacService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockEmail = 'user@example.com';

  const mockRequestWithUser = {
    domainContext: {
      domainId: mockDomainId,
    },
    user: {
      sub: mockUserId,
    },
  };

  const mockRequestWithDomainContext = {
    domainContext: {
      domainId: mockDomainId,
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

  const mockRolesAndPermissions = {
    roles: ['admin', 'editor'],
    permissions: ['users.read', 'users.write', 'posts.read'],
  };

  const mockGetMeResponse = {
    ...mockUserResponse,
    roles: mockRolesAndPermissions.roles,
    permissions: mockRolesAndPermissions.permissions,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: RbacService,
          useValue: {
            getUserRolesAndPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
    rbacService = module.get(RbacService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return user information with roles and permissions when domainContext and user are present', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);
      rbacService.getUserRolesAndPermissions.mockResolvedValue(mockRolesAndPermissions);

      // Act
      const result = await controller.getMe(mockRequestWithUser as any);

      // Assert
      expect(result).toEqual(mockGetMeResponse);
      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
      expect(rbacService.getUserRolesAndPermissions).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(userService.findById).toHaveBeenCalledTimes(1);
      expect(rbacService.getUserRolesAndPermissions).toHaveBeenCalledTimes(1);
    });

    it('should call userService.findById with correct domainId and userId', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);
      rbacService.getUserRolesAndPermissions.mockResolvedValue(mockRolesAndPermissions);

      // Act
      await controller.getMe(mockRequestWithUser as any);

      // Assert
      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
    });

    it('should call rbacService.getUserRolesAndPermissions with correct domainId and userId', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);
      rbacService.getUserRolesAndPermissions.mockResolvedValue(mockRolesAndPermissions);

      // Act
      await controller.getMe(mockRequestWithUser as any);

      // Assert
      expect(rbacService.getUserRolesAndPermissions).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });

    it('should combine UserResponseDto with roles and permissions', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);
      rbacService.getUserRolesAndPermissions.mockResolvedValue(mockRolesAndPermissions);

      // Act
      const result = await controller.getMe(mockRequestWithUser as any);

      // Assert
      expect(result).toEqual(mockGetMeResponse);
      expect(result).toHaveProperty('id', mockUserResponse.id);
      expect(result).toHaveProperty('email', mockUserResponse.email);
      expect(result).toHaveProperty('roles', mockRolesAndPermissions.roles);
      expect(result).toHaveProperty('permissions', mockRolesAndPermissions.permissions);
    });

    it('should return object with all UserResponseDto properties plus roles and permissions', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);
      rbacService.getUserRolesAndPermissions.mockResolvedValue(mockRolesAndPermissions);

      // Act
      const result = await controller.getMe(mockRequestWithUser as any);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('full_name');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('is_active');
      expect(result).toHaveProperty('is_verified');
      expect(result).toHaveProperty('mfa_enabled');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('updated_at');
      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('permissions');
      expect(Array.isArray(result.roles)).toBe(true);
      expect(Array.isArray(result.permissions)).toBe(true);
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.getMe(mockRequestWithoutDomain as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.getMe(mockRequestWithoutDomain as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(userService.findById).not.toHaveBeenCalled();
      expect(rbacService.getUserRolesAndPermissions).not.toHaveBeenCalled();
    });

    it('should throw Error when req.user.sub is not present', async () => {
      // Act & Assert
      await expect(
        controller.getMe(mockRequestWithoutUser as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.getMe(mockRequestWithoutUser as any),
      ).rejects.toThrow('Domain context and user are required');

      expect(userService.findById).not.toHaveBeenCalled();
      expect(rbacService.getUserRolesAndPermissions).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context and user are required"', async () => {
      // Act & Assert
      await expect(
        controller.getMe(mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.getMe(mockRequestEmpty as any),
      ).rejects.toThrow('Domain context and user are required');
    });

    it('should propagate UserService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('User not found');
      userService.findById.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.getMe(mockRequestWithUser as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getMe(mockRequestWithUser as any),
      ).rejects.toThrow('User not found');

      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
      expect(rbacService.getUserRolesAndPermissions).not.toHaveBeenCalled();
    });

    it('should propagate RbacService errors (NotFoundException)', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);
      const notFoundError = new NotFoundException('User not found');
      rbacService.getUserRolesAndPermissions.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.getMe(mockRequestWithUser as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getMe(mockRequestWithUser as any),
      ).rejects.toThrow('User not found');

      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
      expect(rbacService.getUserRolesAndPermissions).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
    });
  });

  describe('findById', () => {
    it('should return user information when domainContext is present', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.findById(mockUserId, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
      expect(userService.findById).toHaveBeenCalledTimes(1);
    });

    it('should call userService.findById with correct domainId and id', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);

      // Act
      await controller.findById(mockUserId, mockRequestWithDomainContext as any);

      // Assert
      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
    });

    it('should return UserResponseDto', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUserResponse);

      // Act
      const result = await controller.findById(mockUserId, mockRequestWithDomainContext as any);

      // Assert
      expect(result).toEqual(mockUserResponse);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('full_name');
      expect(result).toHaveProperty('is_active');
      expect(result).not.toHaveProperty('roles');
      expect(result).not.toHaveProperty('permissions');
    });

    it('should throw Error when domainContext.domainId is not present', async () => {
      // Act & Assert
      await expect(
        controller.findById(mockUserId, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.findById(mockUserId, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required');

      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('should throw Error with message "Domain context is required"', async () => {
      // Act & Assert
      await expect(
        controller.findById(mockUserId, mockRequestEmpty as any),
      ).rejects.toThrow(Error);
      await expect(
        controller.findById(mockUserId, mockRequestEmpty as any),
      ).rejects.toThrow('Domain context is required');
    });

    it('should propagate UserService errors (NotFoundException)', async () => {
      // Arrange
      const notFoundError = new NotFoundException('User not found');
      userService.findById.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(
        controller.findById(mockUserId, mockRequestWithDomainContext as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.findById(mockUserId, mockRequestWithDomainContext as any),
      ).rejects.toThrow('User not found');

      expect(userService.findById).toHaveBeenCalledWith(mockDomainId, mockUserId);
    });
  });
});

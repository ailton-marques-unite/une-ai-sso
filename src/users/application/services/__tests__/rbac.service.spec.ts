import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { RbacService, UserRolesAndPermissions } from '../rbac-service/rbac.service';
import { UserRole } from '../../../domain/entities/user-role.entity';
import { DomainRole } from '../../../../domains/domain/entities/domain-role.entity';
import { User } from '../../../domain/entities/user.entity';

describe('RbacService', () => {
  let service: RbacService;
  let userRoleRepository: jest.Mocked<Repository<UserRole>>;
  let domainRoleRepository: jest.Mocked<Repository<DomainRole>>;
  let userRepository: jest.Mocked<Repository<User>>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockRoleId1 = 'role-uuid-1';
  const mockRoleId2 = 'role-uuid-2';
  const mockUserRoleId1 = 'user-role-uuid-1';
  const mockUserRoleId2 = 'user-role-uuid-2';

  const mockDomainRole1: DomainRole = {
    id: mockRoleId1,
    domain_id: mockDomainId,
    name: 'admin',
    permissions: ['users.read', 'users.write', 'users.delete'],
    description: 'Administrator role',
    created_at: new Date(),
  } as DomainRole;

  const mockDomainRole2: DomainRole = {
    id: mockRoleId2,
    domain_id: mockDomainId,
    name: 'editor',
    permissions: ['users.read', 'posts.write'], // users.read is duplicate
    description: 'Editor role',
    created_at: new Date(),
  } as DomainRole;

  const mockUserRole1: UserRole = {
    id: mockUserRoleId1,
    user_id: mockUserId,
    role_id: mockRoleId1,
    role: mockDomainRole1,
    created_at: new Date(),
  } as UserRole;

  const mockUserRole2: UserRole = {
    id: mockUserRoleId2,
    user_id: mockUserId,
    role_id: mockRoleId2,
    role: mockDomainRole2,
    created_at: new Date(),
  } as UserRole;

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: 'test@example.com',
    is_active: true,
    roles: [mockUserRole1, mockUserRole2],
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  const mockUserWithoutRoles: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: 'test@example.com',
    is_active: true,
    roles: [],
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: getRepositoryToken(UserRole),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DomainRole),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    userRoleRepository = module.get(getRepositoryToken(UserRole));
    domainRoleRepository = module.get(getRepositoryToken(DomainRole));
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRolesAndPermissions', () => {
    it('should return roles and permissions when user exists and has roles', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserRolesAndPermissions(mockDomainId, mockUserId);

      // Assert
      expect(result).toEqual({
        roles: ['admin', 'editor'],
        permissions: ['users.read', 'users.write', 'users.delete', 'posts.write'],
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should return empty arrays when user has no roles', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUserWithoutRoles);

      // Act
      const result = await service.getUserRolesAndPermissions(mockDomainId, mockUserId);

      // Assert
      expect(result).toEqual({
        roles: [],
        permissions: [],
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should aggregate permissions from multiple roles', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserRolesAndPermissions(mockDomainId, mockUserId);

      // Assert
      expect(result.permissions).toContain('users.read');
      expect(result.permissions).toContain('users.write');
      expect(result.permissions).toContain('users.delete');
      expect(result.permissions).toContain('posts.write');
      expect(result.permissions.length).toBe(4);
    });

    it('should remove duplicate permissions using Set', async () => {
      // Arrange
      // mockUser has roles with duplicate 'users.read' permission
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserRolesAndPermissions(mockDomainId, mockUserId);

      // Assert
      const usersReadCount = result.permissions.filter((p) => p === 'users.read').length;
      expect(usersReadCount).toBe(1); // Should appear only once
    });

    it('should return only role names (not IDs)', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserRolesAndPermissions(mockDomainId, mockUserId);

      // Assert
      expect(result.roles).toEqual(['admin', 'editor']);
      expect(result.roles).not.toContain(mockRoleId1);
      expect(result.roles).not.toContain(mockRoleId2);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getUserRolesAndPermissions(mockDomainId, mockUserId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getUserRolesAndPermissions(mockDomainId, mockUserId),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should throw NotFoundException when user does not belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getUserRolesAndPermissions('different-domain-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getUserRolesAndPermissions('different-domain-id', mockUserId),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: 'different-domain-id' },
        relations: ['roles', 'roles.role'],
      });
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user when both exist and belong to domain', async () => {
      // Arrange
      const mockCreatedUserRole = {
        id: 'new-user-role-uuid',
        user_id: mockUserId,
        role_id: mockRoleId1,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole1);
      userRoleRepository.findOne.mockResolvedValue(null); // No existing association
      userRoleRepository.create.mockReturnValue(mockCreatedUserRole as UserRole);
      userRoleRepository.save.mockResolvedValue(mockCreatedUserRole as UserRole);

      // Act
      await service.assignRoleToUser(mockDomainId, mockUserId, mockRoleId1);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRoleId1, domain_id: mockDomainId },
      });
      expect(userRoleRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, role_id: mockRoleId1 },
      });
      expect(userRoleRepository.create).toHaveBeenCalledWith({
        user_id: mockUserId,
        role_id: mockRoleId1,
      });
      expect(userRoleRepository.save).toHaveBeenCalled();
    });

    it('should return without error when role is already assigned (idempotent)', async () => {
      // Arrange
      const existingUserRole = { ...mockUserRole1 };
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole1);
      userRoleRepository.findOne.mockResolvedValue(existingUserRole);

      // Act
      await service.assignRoleToUser(mockDomainId, mockUserId, mockRoleId1);

      // Assert
      expect(userRoleRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: mockUserId, role_id: mockRoleId1 },
      });
      expect(userRoleRepository.create).not.toHaveBeenCalled();
      expect(userRoleRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(domainRoleRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignRoleToUser('different-domain-id', mockUserId, mockRoleId1),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignRoleToUser('different-domain-id', mockUserId, mockRoleId1),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: 'different-domain-id' },
      });
    });

    it('should throw NotFoundException when role does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow('Role not found');

      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRoleId1, domain_id: mockDomainId },
      });
      expect(userRoleRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when role does not belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, 'different-role-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, 'different-role-id'),
      ).rejects.toThrow('Role not found');

      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'different-role-id', domain_id: mockDomainId },
      });
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove role from user when both exist and belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole1);
      userRoleRepository.delete.mockResolvedValue(undefined as any);

      // Act
      await service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId1);

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRoleId1, domain_id: mockDomainId },
      });
      expect(userRoleRepository.delete).toHaveBeenCalledWith({
        user_id: mockUserId,
        role_id: mockRoleId1,
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
      });
      expect(domainRoleRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeRoleFromUser('different-domain-id', mockUserId, mockRoleId1),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeRoleFromUser('different-domain-id', mockUserId, mockRoleId1),
      ).rejects.toThrow('User not found');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: 'different-domain-id' },
      });
    });

    it('should throw NotFoundException when role does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId1),
      ).rejects.toThrow('Role not found');

      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRoleId1, domain_id: mockDomainId },
      });
      expect(userRoleRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when role does not belong to domain', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, 'different-role-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, 'different-role-id'),
      ).rejects.toThrow('Role not found');

      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'different-role-id', domain_id: mockDomainId },
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has the permission', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.hasPermission(
        mockDomainId,
        mockUserId,
        'users.read',
      );

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should return false when user does not have the permission', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.hasPermission(
        mockDomainId,
        mockUserId,
        'non-existent-permission',
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should propagate errors from getUserRolesAndPermissions', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.hasPermission(mockDomainId, mockUserId, 'users.read'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.hasPermission(mockDomainId, mockUserId, 'users.read'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the role', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.hasRole(mockDomainId, mockUserId, 'admin');

      // Assert
      expect(result).toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should return false when user does not have the role', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.hasRole(mockDomainId, mockUserId, 'non-existent-role');

      // Assert
      expect(result).toBe(false);
    });

    it('should propagate errors from getUserRolesAndPermissions', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.hasRole(mockDomainId, mockUserId, 'admin'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.hasRole(mockDomainId, mockUserId, 'admin'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('requirePermission', () => {
    it('should return void when user has the permission', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await service.requirePermission(mockDomainId, mockUserId, 'users.read');

      // Assert - should not throw
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should throw ForbiddenException when user does not have the permission', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'non-existent-permission'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'non-existent-permission'),
      ).rejects.toThrow('Permission required: non-existent-permission');
    });

    it('should include permission name in error message', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'custom.permission'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'custom.permission'),
      ).rejects.toThrow('Permission required: custom.permission');
    });

    it('should propagate errors from getUserRolesAndPermissions', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'users.read'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'users.read'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('requireRole', () => {
    it('should return void when user has the role', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await service.requireRole(mockDomainId, mockUserId, 'admin');

      // Assert - should not throw
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
    });

    it('should throw ForbiddenException when user does not have the role', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.requireRole(mockDomainId, mockUserId, 'non-existent-role'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.requireRole(mockDomainId, mockUserId, 'non-existent-role'),
      ).rejects.toThrow('Role required: non-existent-role');
    });

    it('should include role name in error message', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.requireRole(mockDomainId, mockUserId, 'custom-role'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.requireRole(mockDomainId, mockUserId, 'custom-role'),
      ).rejects.toThrow('Role required: custom-role');
    });

    it('should propagate errors from getUserRolesAndPermissions', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.requireRole(mockDomainId, mockUserId, 'admin'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.requireRole(mockDomainId, mockUserId, 'admin'),
      ).rejects.toThrow('User not found');
    });
  });
});

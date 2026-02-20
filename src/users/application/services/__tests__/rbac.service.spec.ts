import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  RbacService,
  UserRolesAndPermissions,
} from '../rbac-service/rbac.service';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserRoleService } from '../user-role-service/user-role.service';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/entities/user-role.entity';
import { DomainRole } from '../../../../domains/domain/entities/domain-role.entity';
import { APP_LOGGER } from '../../../../shared/utils/logger';

describe('RbacService', () => {
  let service: RbacService;
  let userRepository: jest.Mocked<IUserRepository>;
  let userRoleService: jest.Mocked<UserRoleService>;

  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';

  const mockRoleAdmin: DomainRole = {
    id: 'role-admin',
    domain_id: mockDomainId,
    name: 'admin',
    permissions: ['users.read', 'users.write'],
  } as DomainRole;

  const mockRoleViewer: DomainRole = {
    id: 'role-viewer',
    domain_id: mockDomainId,
    name: 'viewer',
    permissions: ['users.read'],
  } as DomainRole;

  const mockUserRoles: UserRole[] = [
    {
      id: 'user-role-1',
      user_id: mockUserId,
      role_id: mockRoleAdmin.id,
      role: mockRoleAdmin,
    } as UserRole,
    {
      id: 'user-role-2',
      user_id: mockUserId,
      role_id: mockRoleViewer.id,
      role: mockRoleViewer,
    } as UserRole,
  ];

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
    email: 'user@example.com',
    roles: mockUserRoles,
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: 'IUserRepository',
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: UserRoleService,
          useValue: {
            assignRoleToUser: jest.fn(),
            removeRoleFromUser: jest.fn(),
          },
        },
        {
          provide: APP_LOGGER,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    userRepository = module.get('IUserRepository');
    userRoleService = module.get(UserRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRolesAndPermissions', () => {
    it('should throw NotFoundException when user is not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.getUserRolesAndPermissions(mockDomainId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should aggregate roles and permissions from user roles', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result: UserRolesAndPermissions =
        await service.getUserRolesAndPermissions(mockDomainId, mockUserId);

      expect(result.roles.sort()).toEqual(['admin', 'viewer']);
      expect(result.permissions.sort()).toEqual(
        ['users.read', 'users.write'].sort(),
      );
    });
  });

  describe('assignRoleToUser', () => {
    it('should delegate to UserRoleService.assignRoleToUser', async () => {
      await service.assignRoleToUser(mockDomainId, mockUserId, mockRoleAdmin.id);

      expect(userRoleService.assignRoleToUser).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        { domainRoleId: mockRoleAdmin.id },
      );
    });
  });

  describe('removeRoleFromUser', () => {
    it('should delegate to UserRoleService.removeRoleFromUser', async () => {
      await service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleAdmin.id);

      expect(userRoleService.removeRoleFromUser).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
        mockRoleAdmin.id,
      );
    });
  });

  describe('hasPermission', () => {
    it('should return true when permission is present', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.hasPermission(
        mockDomainId,
        mockUserId,
        'users.write',
      );

      expect(result).toBe(true);
    });

    it('should return false when permission is not present', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.hasPermission(
        mockDomainId,
        mockUserId,
        'non.existent',
      );

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when role is present', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.hasRole(
        mockDomainId,
        mockUserId,
        'admin',
      );

      expect(result).toBe(true);
    });

    it('should return false when role is not present', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.hasRole(
        mockDomainId,
        mockUserId,
        'non-existent-role',
      );

      expect(result).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw when permission is present', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'users.read'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when permission is missing', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.requirePermission(mockDomainId, mockUserId, 'non.existent'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('requireRole', () => {
    it('should not throw when role is present', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.requireRole(mockDomainId, mockUserId, 'admin'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when role is missing', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.requireRole(mockDomainId, mockUserId, 'non-existent-role'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});


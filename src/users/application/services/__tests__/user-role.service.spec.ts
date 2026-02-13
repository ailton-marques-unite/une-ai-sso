import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRoleService } from '../user-role-service/user-role.service';
import { UserRole } from '../../../domain/entities/user-role.entity';
import { User } from '../../../domain/entities/user.entity';
import { DomainRole } from '../../../../domains/domain/entities/domain-role.entity';
import { AssignUserRoleDto } from '../../dtos/assign-user-role.dto';
import { ListUserRolesQueryDto } from '../../dtos/list-user-roles-query.dto';

describe('UserRoleService', () => {
  let service: UserRoleService;
  let userRoleRepository: jest.Mocked<Repository<UserRole>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let domainRoleRepository: jest.Mocked<Repository<DomainRole>>;

  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockRoleId = 'role-uuid';

  const mockUser: User = {
    id: mockUserId,
    domain_id: mockDomainId,
  } as User;

  const mockDomainRole: DomainRole = {
    id: mockRoleId,
    domain_id: mockDomainId,
    name: 'admin',
  } as DomainRole;

  const mockUserRole: UserRole = {
    id: 'user-role-uuid',
    user_id: mockUserId,
    role_id: mockRoleId,
    user: mockUser,
    role: mockDomainRole,
  } as UserRole;

  const assignDto: AssignUserRoleDto = {
    domainRoleId: mockRoleId,
  };

  const listQuery: ListUserRolesQueryDto = {
    page: 1,
    limit: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRoleService,
        {
          provide: getRepositoryToken(UserRole),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DomainRole),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserRoleService>(UserRoleService);
    userRoleRepository = module.get(getRepositoryToken(UserRole));
    userRepository = module.get(getRepositoryToken(User));
    domainRoleRepository = module.get(getRepositoryToken(DomainRole));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listUserRoles', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.listUserRoles(mockDomainId, mockUserId, listQuery),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated roles when user exists', async () => {
      const userWithRoles: User = {
        ...mockUser,
        roles: [mockUserRole],
      } as User;
      userRepository.findOne.mockResolvedValue(userWithRoles);

      const result = await service.listUserRoles(
        mockDomainId,
        mockUserId,
        listQuery,
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId, domain_id: mockDomainId },
        relations: ['roles', 'roles.role'],
      });
      expect(result).toEqual([mockUserRole]);
    });

    it('should filter roles by domainId when provided in query', async () => {
      const otherDomainRole: DomainRole = {
        id: 'other-role',
        domain_id: 'other-domain',
        name: 'other',
      } as DomainRole;

      const otherUserRole: UserRole = {
        id: 'other-user-role',
        user_id: mockUserId,
        role_id: otherDomainRole.id,
        user: mockUser,
        role: otherDomainRole,
      } as UserRole;

      const userWithRoles: User = {
        ...mockUser,
        roles: [mockUserRole, otherUserRole],
      } as User;

      userRepository.findOne.mockResolvedValue(userWithRoles);

      const query: ListUserRolesQueryDto = {
        page: 1,
        limit: 10,
        domainId: mockDomainId,
      };

      const result = await service.listUserRoles(
        mockDomainId,
        mockUserId,
        query,
      );

      expect(result).toEqual([mockUserRole]);
    });
  });

  describe('assignRoleToUser', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, assignDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when role does not exist', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, assignDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user already has role', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);
      userRoleRepository.findOne.mockResolvedValue(mockUserRole);

      await expect(
        service.assignRoleToUser(mockDomainId, mockUserId, assignDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should create and save new UserRole when user and role exist and no existing association', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);
      userRoleRepository.findOne.mockResolvedValue(null);
      userRoleRepository.create.mockReturnValue(mockUserRole);
      userRoleRepository.save.mockResolvedValue(mockUserRole);

      const result = await service.assignRoleToUser(
        mockDomainId,
        mockUserId,
        assignDto,
      );

      expect(userRoleRepository.create).toHaveBeenCalledWith({
        user_id: mockUserId,
        role_id: assignDto.domainRoleId,
      });
      expect(userRoleRepository.save).toHaveBeenCalledWith(mockUserRole);
      expect(result).toEqual(mockUserRole);
    });
  });

  describe('removeRoleFromUser', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when role does not exist', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete association when user and role exist and association is found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);
      userRoleRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId);

      expect(userRoleRepository.delete).toHaveBeenCalledWith({
        user_id: mockUserId,
        role_id: mockRoleId,
      });
    });

    it('should throw NotFoundException when association does not exist', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);
      userRoleRepository.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.removeRoleFromUser(mockDomainId, mockUserId, mockRoleId),
      ).rejects.toThrow(NotFoundException);
      expect(userRoleRepository.delete).toHaveBeenCalledWith({
        user_id: mockUserId,
        role_id: mockRoleId,
      });
    });
  });
});


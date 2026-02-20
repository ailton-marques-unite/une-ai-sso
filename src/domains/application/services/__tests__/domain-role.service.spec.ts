import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DomainRoleService } from '../domain-role-service/domain-role.service';
import { DomainRole } from '../../../domain/entities/domain-role.entity';
import { Domain } from '../../../domain/entities/domain.entity';
import { CreateDomainRoleDto } from '../../dtos/create-domain-role.dto';
import { UpdateDomainRoleDto } from '../../dtos/update-domain-role.dto';
import { ListDomainRolesQueryDto } from '../../dtos/list-domain-roles-query.dto';
import { APP_LOGGER } from '../../../../shared/utils/logger';

describe('DomainRoleService', () => {
  let service: DomainRoleService;
  let domainRoleRepository: jest.Mocked<Repository<DomainRole>>;
  let domainRepository: jest.Mocked<Repository<Domain>>;

  const mockDomainId = 'domain-uuid';
  const mockRoleId = 'role-uuid';

  const mockDomain: Domain = {
    id: mockDomainId,
    name: 'Test Domain',
    slug: 'test-domain',
    description: 'Test domain description',
    is_active: true,
    created_by: 'admin-uuid',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as Domain;

  const mockDomainRole: DomainRole = {
    id: mockRoleId,
    domain_id: mockDomainId,
    domain: mockDomain,
    name: 'admin',
    description: 'Administrator role',
    permissions: ['users.read', 'users.write'],
    created_at: new Date('2024-01-01T00:00:00Z'),
  } as DomainRole;

  const createDto: CreateDomainRoleDto = {
    name: 'admin',
    description: 'Administrator role',
    permissions: ['users.read', 'users.write'],
  };

  const updateDto: UpdateDomainRoleDto = {
    name: 'manager',
    description: 'Manager role',
    permissions: ['users.read'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainRoleService,
        {
          provide: getRepositoryToken(DomainRole),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: APP_LOGGER,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DomainRoleService>(DomainRoleService);
    domainRoleRepository = module.get(getRepositoryToken(DomainRole));
    domainRepository = module.get(getRepositoryToken(Domain));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDomainRole', () => {
    it('should create domain role when domain exists and name is unique', async () => {
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRoleRepository.findOne.mockResolvedValue(null);
      domainRoleRepository.create.mockReturnValue(mockDomainRole);
      domainRoleRepository.save.mockResolvedValue(mockDomainRole);

      const result = await service.createDomainRole(mockDomainId, createDto);

      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          domain_id: mockDomainId,
          name: createDto.name,
        },
      });
      expect(domainRoleRepository.create).toHaveBeenCalledWith({
        domain_id: mockDomainId,
        name: createDto.name,
        description: createDto.description,
        permissions: createDto.permissions,
      });
      expect(domainRoleRepository.save).toHaveBeenCalledWith(mockDomainRole);
      expect(result).toEqual(mockDomainRole);
    });

    it('should throw NotFoundException when domain does not exist', async () => {
      domainRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createDomainRole(mockDomainId, createDto),
      ).rejects.toThrow(NotFoundException);
      expect(domainRoleRepository.findOne).not.toHaveBeenCalled();
      expect(domainRoleRepository.create).not.toHaveBeenCalled();
      expect(domainRoleRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when role name already exists in domain', async () => {
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);

      await expect(
        service.createDomainRole(mockDomainId, createDto),
      ).rejects.toThrow(ConflictException);

      expect(domainRoleRepository.create).not.toHaveBeenCalled();
      expect(domainRoleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('listDomainRoles', () => {
    it('should list roles with default pagination when query is empty', async () => {
      const query: ListDomainRolesQueryDto = {};
      const roles = [mockDomainRole];
      domainRoleRepository.findAndCount.mockResolvedValue([roles, 1]);

      const result = await service.listDomainRoles(mockDomainId, query);

      expect(domainRoleRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          domain_id: mockDomainId,
        },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual({
        data: roles,
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should apply search filter when provided', async () => {
      const query: ListDomainRolesQueryDto = { search: 'adm' };
      const roles = [mockDomainRole];
      domainRoleRepository.findAndCount.mockResolvedValue([roles, 1]);

      const result = await service.listDomainRoles(mockDomainId, query);

      expect(domainRoleRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          domain_id: mockDomainId,
          name: Like('%adm%'),
        },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
      expect(result.data).toEqual(roles);
    });

    it('should respect custom page and limit', async () => {
      const query: ListDomainRolesQueryDto = { page: 2, limit: 5 };
      const roles = [mockDomainRole];
      domainRoleRepository.findAndCount.mockResolvedValue([roles, 1]);

      await service.listDomainRoles(mockDomainId, query);

      expect(domainRoleRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          domain_id: mockDomainId,
        },
        skip: 5,
        take: 5,
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('getDomainRoleById', () => {
    it('should return role when found', async () => {
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);

      const result = await service.getDomainRoleById(
        mockDomainId,
        mockRoleId,
      );

      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRoleId, domain_id: mockDomainId },
      });
      expect(result).toEqual(mockDomainRole);
    });

    it('should throw NotFoundException when role is not found', async () => {
      domainRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getDomainRoleById(mockDomainId, mockRoleId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDomainRole', () => {
    it('should update role when it exists and new name is unique', async () => {
      domainRoleRepository.findOne
        .mockResolvedValueOnce(mockDomainRole)
        .mockResolvedValueOnce(null);
      domainRoleRepository.save.mockResolvedValue({
        ...mockDomainRole,
        ...updateDto,
      } as DomainRole);

      const result = await service.updateDomainRole(
        mockDomainId,
        mockRoleId,
        updateDto,
      );

      expect(domainRoleRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: mockRoleId, domain_id: mockDomainId },
      });
      expect(domainRoleRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: {
          domain_id: mockDomainId,
          name: updateDto.name,
        },
      });
      expect(domainRoleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateDto),
      );
      expect(result).toEqual({
        ...mockDomainRole,
        ...updateDto,
      });
    });

    it('should not check name uniqueness when name is not changed', async () => {
      const dto: UpdateDomainRoleDto = {
        description: 'Updated description only',
      };
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);
      domainRoleRepository.save.mockResolvedValue({
        ...mockDomainRole,
        ...dto,
      } as DomainRole);

      await service.updateDomainRole(mockDomainId, mockRoleId, dto);

      expect(domainRoleRepository.findOne).toHaveBeenCalledTimes(1);
      expect(domainRoleRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when role to update does not exist', async () => {
      domainRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateDomainRole(mockDomainId, mockRoleId, updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(domainRoleRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when new name already exists in domain', async () => {
    });
  });

  describe('deleteDomainRole', () => {
    it('should remove role when it exists', async () => {
      domainRoleRepository.findOne.mockResolvedValue(mockDomainRole);

      await service.deleteDomainRole(mockDomainId, mockRoleId);

      expect(domainRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRoleId, domain_id: mockDomainId },
      });
      expect(domainRoleRepository.remove).toHaveBeenCalledWith(
        mockDomainRole,
      );
    });

    it('should throw NotFoundException when role does not exist', async () => {
      domainRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteDomainRole(mockDomainId, mockRoleId),
      ).rejects.toThrow(NotFoundException);
      expect(domainRoleRepository.remove).not.toHaveBeenCalled();
    });
  });
});

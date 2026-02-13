import { Test, TestingModule } from '@nestjs/testing';
import { DomainRoleController } from '../domain-role.controller';
import { DomainRoleService } from '../../../application/services/domain-role-service/domain-role.service';
import { CreateDomainRoleDto } from '../../../application/dtos/create-domain-role.dto';
import { UpdateDomainRoleDto } from '../../../application/dtos/update-domain-role.dto';
import { ListDomainRolesQueryDto } from '../../../application/dtos/list-domain-roles-query.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';

describe('DomainRoleController', () => {
  let controller: DomainRoleController;
  let domainRoleService: jest.Mocked<DomainRoleService>;

  const mockDomainId = 'domain-uuid';
  const mockRoleId = 'role-uuid';

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

  const listQuery: ListDomainRolesQueryDto = {
    page: 1,
    limit: 10,
    search: 'adm',
  };

  const listResult = {
    data: [],
    total: 0,
    page: 1,
    limit: 10,
  };

  const mockCanActivate = { canActivate: () => true };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainRoleController],
      providers: [
        {
          provide: DomainRoleService,
          useValue: {
            listDomainRoles: jest.fn().mockResolvedValue(listResult),
            createDomainRole: jest.fn(),
            getDomainRoleById: jest.fn(),
            updateDomainRole: jest.fn(),
            deleteDomainRole: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockCanActivate)
      .overrideGuard(RolesGuard)
      .useValue(mockCanActivate)
      .compile();

    controller = module.get<DomainRoleController>(DomainRoleController);
    domainRoleService = module.get(DomainRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should delegate to DomainRoleService.listDomainRoles with correct params', async () => {
      const result = await controller.list(mockDomainId, listQuery);

      expect(domainRoleService.listDomainRoles).toHaveBeenCalledWith(
        mockDomainId,
        listQuery,
      );
      expect(result).toEqual(listResult);
    });
  });

  describe('create', () => {
    it('should delegate to DomainRoleService.createDomainRole', async () => {
      const createdRole = { id: mockRoleId } as any;
      domainRoleService.createDomainRole.mockResolvedValue(createdRole);

      const result = await controller.create(mockDomainId, createDto);

      expect(domainRoleService.createDomainRole).toHaveBeenCalledWith(
        mockDomainId,
        createDto,
      );
      expect(result).toEqual(createdRole);
    });
  });

  describe('getById', () => {
    it('should delegate to DomainRoleService.getDomainRoleById', async () => {
      const role = { id: mockRoleId } as any;
      domainRoleService.getDomainRoleById.mockResolvedValue(role);

      const result = await controller.getById(mockDomainId, mockRoleId);

      expect(domainRoleService.getDomainRoleById).toHaveBeenCalledWith(
        mockDomainId,
        mockRoleId,
      );
      expect(result).toEqual(role);
    });
  });

  describe('update', () => {
    it('should delegate to DomainRoleService.updateDomainRole', async () => {
      const updatedRole = { id: mockRoleId, ...updateDto } as any;
      domainRoleService.updateDomainRole.mockResolvedValue(updatedRole);

      const result = await controller.update(
        mockDomainId,
        mockRoleId,
        updateDto,
      );

      expect(domainRoleService.updateDomainRole).toHaveBeenCalledWith(
        mockDomainId,
        mockRoleId,
        updateDto,
      );
      expect(result).toEqual(updatedRole);
    });
  });

  describe('delete', () => {
    it('should delegate to DomainRoleService.deleteDomainRole', async () => {
      domainRoleService.deleteDomainRole.mockResolvedValue(undefined);

      await controller.delete(mockDomainId, mockRoleId);

      expect(domainRoleService.deleteDomainRole).toHaveBeenCalledWith(
        mockDomainId,
        mockRoleId,
      );
    });
  });
});


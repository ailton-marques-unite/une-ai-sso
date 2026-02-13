import { Test, TestingModule } from '@nestjs/testing';
import { RbacController } from '../rbac.controller';
import { RbacService } from '../../../application/services/rbac-service/rbac.service';

describe('RbacController', () => {
  let controller: RbacController;
  let rbacService: jest.Mocked<RbacService>;

  const mockDomainId = 'domain-uuid';
  const mockUserId = 'user-uuid';
  const mockRoleId = 'role-uuid';

  const mockRolesAndPermissions = {
    roles: ['admin'],
    permissions: ['users.read', 'users.write'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RbacController],
      providers: [
        {
          provide: RbacService,
          useValue: {
            getUserRolesAndPermissions: jest
              .fn()
              .mockResolvedValue(mockRolesAndPermissions),
          },
        },
      ],
    }).compile();

    controller = module.get<RbacController>(RbacController);
    rbacService = module.get(RbacService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRolesAndPermissions', () => {
    it('should delegate to RbacService.getUserRolesAndPermissions and return its result', async () => {
      const result = await controller.getUserRolesAndPermissions(
        mockDomainId,
        mockUserId,
      );

      expect(rbacService.getUserRolesAndPermissions).toHaveBeenCalledWith(
        mockDomainId,
        mockUserId,
      );
      expect(result).toEqual(mockRolesAndPermissions);
    });
  });

  describe('getUsersByRole', () => {
    it('should return the stubbed response with domainId, roleId and empty users array', async () => {
      const result = await controller.getUsersByRole(mockDomainId, mockRoleId);

      expect(result).toEqual({
        domainId: mockDomainId,
        roleId: mockRoleId,
        users: [],
      });
    });
  });
});


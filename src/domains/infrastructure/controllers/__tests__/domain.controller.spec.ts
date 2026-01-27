import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainController } from '../domain.controller';
import { DomainService } from '../../../application/services/domain-service/domain.service';
import { CreateDomainDto } from '../../../application/dtos/create-domain.dto';
import { UpdateDomainDto } from '../../../application/dtos/update-domain.dto';
import { ListDomainsQueryDto } from '../../../application/dtos/list-domains-query.dto';
import { DomainResponseDto } from '../../../application/dtos/domain-response.dto';

// Mock crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
}));

describe('DomainController', () => {
  let controller: DomainController;
  let domainService: jest.Mocked<DomainService>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockSlug = 'test-domain';
  const mockSystemUserId = 'system-user-uuid';
  const mockRandomUuid = 'random-uuid-generated';

  const mockCreateDomainDto: CreateDomainDto = {
    name: 'Test Domain',
    slug: mockSlug,
    description: 'Test description',
  };

  const mockUpdateDomainDto: UpdateDomainDto = {
    name: 'Updated Domain',
    slug: 'updated-domain',
    is_active: true,
  };

  const mockListDomainsQueryDto: ListDomainsQueryDto = {
    page: 1,
    limit: 10,
    is_active: true,
    search: 'test',
  };

  const mockDomainResponse: DomainResponseDto = {
    id: mockDomainId,
    name: 'Test Domain',
    slug: mockSlug,
    description: 'Test description',
    is_active: true,
    created_by: mockSystemUserId,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  // Mock Domain entity (what DomainService returns)
  const mockDomain = {
    ...mockDomainResponse,
    roles: [],
  };

  const mockFindAllResponse = {
    data: [mockDomain as any],
    total: 1,
    page: 1,
    limit: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainController],
      providers: [
        {
          provide: DomainService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findBySlug: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            activate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DomainController>(DomainController);
    domainService = module.get(DomainService);

    // Reset mocks
    jest.clearAllMocks();
    (randomUUID as jest.Mock).mockReturnValue(mockRandomUuid);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SYSTEM_USER_ID;
  });

  describe('create', () => {
    it('should create domain when data is valid', async () => {
      // Arrange
      domainService.create.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.create(mockCreateDomainDto);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
      expect(domainService.create).toHaveBeenCalled();
    });

    it('should call domainService.create with createDomainDto and createdBy', async () => {
      // Arrange
      domainService.create.mockResolvedValue(mockDomain as any);
      process.env.SYSTEM_USER_ID = mockSystemUserId;

      // Act
      await controller.create(mockCreateDomainDto);

      // Assert
      expect(domainService.create).toHaveBeenCalledWith(
        mockCreateDomainDto,
        mockSystemUserId,
      );
    });

    it('should use SYSTEM_USER_ID from process.env when available', async () => {
      // Arrange
      process.env.SYSTEM_USER_ID = mockSystemUserId;
      domainService.create.mockResolvedValue(mockDomain as any);

      // Act
      await controller.create(mockCreateDomainDto);

      // Assert
      expect(domainService.create).toHaveBeenCalledWith(
        mockCreateDomainDto,
        mockSystemUserId,
      );
      expect(randomUUID).not.toHaveBeenCalled();
    });

    it('should use randomUUID() when SYSTEM_USER_ID is not available', async () => {
      // Arrange
      delete process.env.SYSTEM_USER_ID;
      domainService.create.mockResolvedValue(mockDomain as any);

      // Act
      await controller.create(mockCreateDomainDto);

      // Assert
      expect(domainService.create).toHaveBeenCalledWith(
        mockCreateDomainDto,
        mockRandomUuid,
      );
      expect(randomUUID).toHaveBeenCalled();
    });

    it('should return DomainResponseDto', async () => {
      // Arrange
      domainService.create.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.create(mockCreateDomainDto);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('slug');
    });

    it('should propagate ConflictException when slug already exists', async () => {
      // Arrange
      const conflictError = new ConflictException('Domain with slug "test-domain" already exists');
      domainService.create.mockRejectedValue(conflictError);

      // Act & Assert
      await expect(controller.create(mockCreateDomainDto)).rejects.toThrow(ConflictException);
      await expect(controller.create(mockCreateDomainDto)).rejects.toThrow(
        'Domain with slug "test-domain" already exists',
      );
    });

    it('should propagate other errors from DomainService', async () => {
      // Arrange
      const error = new Error('Unexpected error');
      domainService.create.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.create(mockCreateDomainDto)).rejects.toThrow('Unexpected error');
    });
  });

  describe('findAll', () => {
    it('should return paginated list of domains when query is empty', async () => {
      // Arrange
      const emptyQuery: ListDomainsQueryDto = {};
      domainService.findAll.mockResolvedValue(mockFindAllResponse);

      // Act
      const result = await controller.findAll(emptyQuery);

      // Assert
      expect(result).toEqual(mockFindAllResponse);
      expect(domainService.findAll).toHaveBeenCalledWith(emptyQuery);
    });

    it('should call domainService.findAll with correct query', async () => {
      // Arrange
      domainService.findAll.mockResolvedValue(mockFindAllResponse);

      // Act
      await controller.findAll(mockListDomainsQueryDto);

      // Assert
      expect(domainService.findAll).toHaveBeenCalledWith(mockListDomainsQueryDto);
    });

    it('should return result from domainService.findAll', async () => {
      // Arrange
      domainService.findAll.mockResolvedValue(mockFindAllResponse);

      // Act
      const result = await controller.findAll(mockListDomainsQueryDto);

      // Assert
      expect(result).toEqual(mockFindAllResponse);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });

    it('should work with complete query (page, limit, is_active, search)', async () => {
      // Arrange
      domainService.findAll.mockResolvedValue(mockFindAllResponse);

      // Act
      const result = await controller.findAll(mockListDomainsQueryDto);

      // Assert
      expect(result).toEqual(mockFindAllResponse);
      expect(domainService.findAll).toHaveBeenCalledWith(mockListDomainsQueryDto);
    });
  });

  describe('findOne', () => {
    it('should return DomainResponseDto when domain is found', async () => {
      // Arrange
      domainService.findOne.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.findOne(mockDomainId);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
      expect(domainService.findOne).toHaveBeenCalledWith(mockDomainId);
    });

    it('should call domainService.findOne with correct id', async () => {
      // Arrange
      domainService.findOne.mockResolvedValue(mockDomain as any);

      // Act
      await controller.findOne(mockDomainId);

      // Assert
      expect(domainService.findOne).toHaveBeenCalledWith(mockDomainId);
    });

    it('should return result from domainService.findOne', async () => {
      // Arrange
      domainService.findOne.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.findOne(mockDomainId);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
    });

    it('should throw Error("Domain not found") when domain is not found', async () => {
      // Arrange
      domainService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findOne(mockDomainId)).rejects.toThrow(Error);
      await expect(controller.findOne(mockDomainId)).rejects.toThrow('Domain not found');
    });

    it('should throw Error with message "Domain not found"', async () => {
      // Arrange
      domainService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findOne(mockDomainId)).rejects.toThrow('Domain not found');
    });
  });

  describe('findBySlug', () => {
    it('should return DomainResponseDto when domain is found', async () => {
      // Arrange
      domainService.findBySlug.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.findBySlug(mockSlug);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
      expect(domainService.findBySlug).toHaveBeenCalledWith(mockSlug);
    });

    it('should call domainService.findBySlug with correct slug', async () => {
      // Arrange
      domainService.findBySlug.mockResolvedValue(mockDomain as any);

      // Act
      await controller.findBySlug(mockSlug);

      // Assert
      expect(domainService.findBySlug).toHaveBeenCalledWith(mockSlug);
    });

    it('should return result from domainService.findBySlug', async () => {
      // Arrange
      domainService.findBySlug.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.findBySlug(mockSlug);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
    });

    it('should throw Error("Domain not found") when domain is not found', async () => {
      // Arrange
      domainService.findBySlug.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findBySlug(mockSlug)).rejects.toThrow(Error);
      await expect(controller.findBySlug(mockSlug)).rejects.toThrow('Domain not found');
    });

    it('should throw Error with message "Domain not found"', async () => {
      // Arrange
      domainService.findBySlug.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findBySlug(mockSlug)).rejects.toThrow('Domain not found');
    });
  });

  describe('update', () => {
    it('should update domain when found', async () => {
      // Arrange
      const updatedDomain = { ...mockDomain, ...mockUpdateDomainDto };
      domainService.update.mockResolvedValue(updatedDomain as any);

      // Act
      const result = await controller.update(mockDomainId, mockUpdateDomainDto);

      // Assert
      expect(result).toMatchObject({ ...mockDomainResponse, ...mockUpdateDomainDto });
      expect(domainService.update).toHaveBeenCalledWith(mockDomainId, mockUpdateDomainDto);
    });

    it('should call domainService.update with correct id and updateDomainDto', async () => {
      // Arrange
      const updatedDomain = { ...mockDomain, ...mockUpdateDomainDto };
      domainService.update.mockResolvedValue(updatedDomain as any);

      // Act
      await controller.update(mockDomainId, mockUpdateDomainDto);

      // Assert
      expect(domainService.update).toHaveBeenCalledWith(mockDomainId, mockUpdateDomainDto);
    });

    it('should return updated DomainResponseDto', async () => {
      // Arrange
      const updatedDomain = { ...mockDomain, ...mockUpdateDomainDto };
      domainService.update.mockResolvedValue(updatedDomain as any);

      // Act
      const result = await controller.update(mockDomainId, mockUpdateDomainDto);

      // Assert
      expect(result).toMatchObject({ ...mockDomainResponse, ...mockUpdateDomainDto });
    });

    it('should throw Error("Domain not found") when domainService.update returns null', async () => {
      // Arrange
      domainService.update.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.update(mockDomainId, mockUpdateDomainDto)).rejects.toThrow(Error);
      await expect(controller.update(mockDomainId, mockUpdateDomainDto)).rejects.toThrow(
        'Domain not found',
      );
    });

    it('should propagate NotFoundException from DomainService', async () => {
      // Arrange
      const notFoundError = new NotFoundException(`Domain with ID "${mockDomainId}" not found`);
      domainService.update.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(controller.update(mockDomainId, mockUpdateDomainDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.update(mockDomainId, mockUpdateDomainDto)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );
    });

    it('should propagate ConflictException when slug already exists', async () => {
      // Arrange
      const conflictError = new ConflictException('Domain with slug "updated-domain" already exists');
      domainService.update.mockRejectedValue(conflictError);

      // Act & Assert
      await expect(controller.update(mockDomainId, mockUpdateDomainDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(controller.update(mockDomainId, mockUpdateDomainDto)).rejects.toThrow(
        'Domain with slug "updated-domain" already exists',
      );
    });
  });

  describe('remove', () => {
    it('should deactivate domain when found', async () => {
      // Arrange
      domainService.remove.mockResolvedValue(true);

      // Act
      await controller.remove(mockDomainId);

      // Assert
      expect(domainService.remove).toHaveBeenCalledWith(mockDomainId);
    });

    it('should call domainService.remove with correct id', async () => {
      // Arrange
      domainService.remove.mockResolvedValue(true);

      // Act
      await controller.remove(mockDomainId);

      // Assert
      expect(domainService.remove).toHaveBeenCalledWith(mockDomainId);
    });

    it('should return void (204 No Content)', async () => {
      // Arrange
      domainService.remove.mockResolvedValue(true);

      // Act
      const result = await controller.remove(mockDomainId);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should not throw error when successful', async () => {
      // Arrange
      domainService.remove.mockResolvedValue(true);

      // Act & Assert
      await expect(controller.remove(mockDomainId)).resolves.not.toThrow();
    });

    it('should propagate NotFoundException when domain is not found', async () => {
      // Arrange
      const notFoundError = new NotFoundException(`Domain with ID "${mockDomainId}" not found`);
      domainService.remove.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(controller.remove(mockDomainId)).rejects.toThrow(NotFoundException);
      await expect(controller.remove(mockDomainId)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );
    });

    it('should propagate other errors from DomainService', async () => {
      // Arrange
      const error = new Error('Unexpected error');
      domainService.remove.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.remove(mockDomainId)).rejects.toThrow('Unexpected error');
    });
  });

  describe('activate', () => {
    it('should activate domain when found', async () => {
      // Arrange
      domainService.activate.mockResolvedValue(true);
      domainService.findOne.mockResolvedValue(mockDomain as any);

      // Act
      const result = await controller.activate(mockDomainId);

      // Assert
      expect(result).toMatchObject(mockDomainResponse);
      expect(domainService.activate).toHaveBeenCalledWith(mockDomainId);
      expect(domainService.findOne).toHaveBeenCalledWith(mockDomainId);
    });

    it('should call domainService.activate with correct id', async () => {
      // Arrange
      domainService.activate.mockResolvedValue(true);
      domainService.findOne.mockResolvedValue(mockDomain as any);

      // Act
      await controller.activate(mockDomainId);

      // Assert
      expect(domainService.activate).toHaveBeenCalledWith(mockDomainId);
    });

    it('should call domainService.findOne after activate to return updated domain', async () => {
      // Arrange
      domainService.activate.mockResolvedValue(true);
      domainService.findOne.mockResolvedValue(mockDomain as any);

      // Act
      await controller.activate(mockDomainId);

      // Assert
      expect(domainService.activate).toHaveBeenCalledWith(mockDomainId);
      expect(domainService.findOne).toHaveBeenCalledWith(mockDomainId);
      expect(domainService.activate).toHaveBeenCalled();
      expect(domainService.findOne).toHaveBeenCalled();
    });

    it('should return DomainResponseDto of activated domain', async () => {
      // Arrange
      const activatedDomain = { ...mockDomain, is_active: true };
      domainService.activate.mockResolvedValue(true);
      domainService.findOne.mockResolvedValue(activatedDomain as any);

      // Act
      const result = await controller.activate(mockDomainId);

      // Assert
      expect(result).toMatchObject({ ...mockDomainResponse, is_active: true });
    });

    it('should throw Error("Domain not found") when findOne returns null after activate', async () => {
      // Arrange
      domainService.activate.mockResolvedValue(true);
      domainService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.activate(mockDomainId)).rejects.toThrow(Error);
      await expect(controller.activate(mockDomainId)).rejects.toThrow('Domain not found');
    });

    it('should propagate NotFoundException from DomainService.activate', async () => {
      // Arrange
      const notFoundError = new NotFoundException(`Domain with ID "${mockDomainId}" not found`);
      domainService.activate.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(controller.activate(mockDomainId)).rejects.toThrow(NotFoundException);
      await expect(controller.activate(mockDomainId)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );
      expect(domainService.findOne).not.toHaveBeenCalled();
    });

    it('should propagate other errors from DomainService', async () => {
      // Arrange
      const error = new Error('Unexpected error');
      domainService.activate.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.activate(mockDomainId)).rejects.toThrow('Unexpected error');
      expect(domainService.findOne).not.toHaveBeenCalled();
    });
  });
});

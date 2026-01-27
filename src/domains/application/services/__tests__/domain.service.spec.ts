import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DomainService } from '../domain-service/domain.service';
import { Domain } from '../../../domain/entities/domain.entity';
import { CreateDomainDto } from '../../dtos/create-domain.dto';
import { UpdateDomainDto } from '../../dtos/update-domain.dto';
import { ListDomainsQueryDto } from '../../dtos/list-domains-query.dto';

describe('DomainService', () => {
  let service: DomainService;
  let domainRepository: jest.Mocked<Repository<Domain>>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockCreatedBy = 'admin-uuid';
  const mockSlug = 'test-domain';
  const mockName = 'Test Domain';
  const mockDescription = 'Test description';

  const mockCreateDomainDto: CreateDomainDto = {
    name: mockName,
    slug: mockSlug,
    description: mockDescription,
  };

  const mockUpdateDomainDto: UpdateDomainDto = {
    name: 'Updated Domain',
    slug: 'updated-domain',
    is_active: true,
  };

  const mockDomain: Domain = {
    id: mockDomainId,
    name: mockName,
    slug: mockSlug,
    description: mockDescription,
    is_active: true,
    created_by: mockCreatedBy,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  } as Domain;

  const mockDomainList: Domain[] = [
    mockDomain,
    {
      ...mockDomain,
      id: 'domain-uuid-2',
      name: 'Another Domain',
      slug: 'another-domain',
    } as Domain,
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainService,
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DomainService>(DomainService);
    domainRepository = module.get(getRepositoryToken(Domain));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create domain when slug does not exist', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);
      domainRepository.create.mockReturnValue(mockDomain);
      domainRepository.save.mockResolvedValue(mockDomain);

      // Act
      const result = await service.create(mockCreateDomainDto, mockCreatedBy);

      // Assert
      expect(result).toEqual(mockDomain);
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockSlug },
      });
      expect(domainRepository.create).toHaveBeenCalledWith({
        ...mockCreateDomainDto,
        created_by: mockCreatedBy,
      });
      expect(domainRepository.save).toHaveBeenCalledWith(mockDomain);
    });

    it('should call domainRepository.findOne to check slug', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);
      domainRepository.create.mockReturnValue(mockDomain);
      domainRepository.save.mockResolvedValue(mockDomain);

      // Act
      await service.create(mockCreateDomainDto, mockCreatedBy);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockSlug },
      });
    });

    it('should call domainRepository.create with correct data including createdBy', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);
      domainRepository.create.mockReturnValue(mockDomain);
      domainRepository.save.mockResolvedValue(mockDomain);

      // Act
      await service.create(mockCreateDomainDto, mockCreatedBy);

      // Assert
      expect(domainRepository.create).toHaveBeenCalledWith({
        ...mockCreateDomainDto,
        created_by: mockCreatedBy,
      });
    });

    it('should call domainRepository.save to persist', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);
      domainRepository.create.mockReturnValue(mockDomain);
      domainRepository.save.mockResolvedValue(mockDomain);

      // Act
      await service.create(mockCreateDomainDto, mockCreatedBy);

      // Assert
      expect(domainRepository.save).toHaveBeenCalledWith(mockDomain);
    });

    it('should return created Domain', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);
      domainRepository.create.mockReturnValue(mockDomain);
      domainRepository.save.mockResolvedValue(mockDomain);

      // Act
      const result = await service.create(mockCreateDomainDto, mockCreatedBy);

      // Assert
      expect(result).toEqual(mockDomain);
    });

    it('should throw ConflictException when slug already exists', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act & Assert
      await expect(
        service.create(mockCreateDomainDto, mockCreatedBy),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(mockCreateDomainDto, mockCreatedBy),
      ).rejects.toThrow(`Domain with slug "${mockSlug}" already exists`);

      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockSlug },
      });
      expect(domainRepository.create).not.toHaveBeenCalled();
      expect(domainRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException with message containing duplicate slug', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act & Assert
      await expect(
        service.create(mockCreateDomainDto, mockCreatedBy),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(mockCreateDomainDto, mockCreatedBy),
      ).rejects.toThrow(`Domain with slug "${mockSlug}" already exists`);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of domains when query is empty', async () => {
      // Arrange
      const query: ListDomainsQueryDto = {};
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result).toEqual({
        data: mockDomainList,
        total: 2,
        page: 1,
        limit: 10,
      });
      expect(domainRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });

    it('should use default values (page=1, limit=10) when not provided', async () => {
      // Arrange
      const query: ListDomainsQueryDto = {};
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      await service.findAll(query);

      // Assert
      expect(domainRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });

    it('should filter by is_active when provided', async () => {
      // Arrange
      const query: ListDomainsQueryDto = { is_active: true };
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      await service.findAll(query);

      // Assert
      expect(domainRepository.findAndCount).toHaveBeenCalledWith({
        where: { is_active: true },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });

    it('should filter by search (partial name search) when provided', async () => {
      // Arrange
      const query: ListDomainsQueryDto = { search: 'test' };
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      await service.findAll(query);

      // Assert
      expect(domainRepository.findAndCount).toHaveBeenCalledWith({
        where: { name: Like('%test%') },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });

    it('should apply correct pagination (skip and take)', async () => {
      // Arrange
      const query: ListDomainsQueryDto = { page: 2, limit: 5 };
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      await service.findAll(query);

      // Assert
      expect(domainRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 5,
        take: 5,
        order: { created_at: 'DESC' },
      });
    });

    it('should order by created_at DESC', async () => {
      // Arrange
      const query: ListDomainsQueryDto = {};
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      await service.findAll(query);

      // Assert
      expect(domainRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
    });

    it('should return object with data, total, page and limit', async () => {
      // Arrange
      const query: ListDomainsQueryDto = {};
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result.data).toEqual(mockDomainList);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should work with multiple filters combined (is_active + search)', async () => {
      // Arrange
      const query: ListDomainsQueryDto = { is_active: true, search: 'test' };
      domainRepository.findAndCount.mockResolvedValue([mockDomainList, 2]);

      // Act
      await service.findAll(query);

      // Assert
      expect(domainRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          is_active: true,
          name: Like('%test%'),
        },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return Domain when found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      const result = await service.findOne(mockDomainId);

      // Assert
      expect(result).toEqual(mockDomain);
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should return null when not found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findOne(mockDomainId);

      // Assert
      expect(result).toBeNull();
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should call domainRepository.findOne with correct id', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.findOne(mockDomainId);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });
  });

  describe('findBySlug', () => {
    it('should return Domain when found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      const result = await service.findBySlug(mockSlug);

      // Assert
      expect(result).toEqual(mockDomain);
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockSlug },
      });
    });

    it('should return null when not found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findBySlug(mockSlug);

      // Assert
      expect(result).toBeNull();
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockSlug },
      });
    });

    it('should call domainRepository.findOne with correct slug', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await service.findBySlug(mockSlug);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockSlug },
      });
    });
  });

  describe('update', () => {
    it('should update domain when found', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { name: 'Updated Name', is_active: true };
      const updatedDomain = { ...mockDomain, ...updateDto };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      const result = await service.update(mockDomainId, updateDto);

      // Assert
      expect(result).toEqual(updatedDomain);
      expect(domainRepository.save).toHaveBeenCalled();
    });

    it('should call findOne to find domain', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { name: 'Updated Name' };
      const updatedDomain = { ...mockDomain, ...updateDto };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      await service.update(mockDomainId, updateDto);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should update fields provided in updateDomainDto', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { name: 'Updated Name', is_active: false };
      const updatedDomain = { ...mockDomain, ...updateDto };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      await service.update(mockDomainId, updateDto);

      // Assert
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: updateDto.name,
          is_active: updateDto.is_active,
        }),
      );
    });

    it('should call domainRepository.save with updated domain', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { name: 'Updated Name' };
      const updatedDomain = { ...mockDomain, ...updateDto };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      await service.update(mockDomainId, updateDto);

      // Assert
      expect(domainRepository.save).toHaveBeenCalled();
    });

    it('should return updated Domain', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { name: 'Updated Name' };
      const updatedDomain = { ...mockDomain, ...updateDto };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      const result = await service.update(mockDomainId, updateDto);

      // Assert
      expect(result).toEqual(updatedDomain);
    });

    it('should update slug when provided and different from current', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { slug: 'new-slug' };
      const updatedDomain = { ...mockDomain, slug: 'new-slug' };
      domainRepository.findOne
        .mockResolvedValueOnce(mockDomain) // findOne for domain
        .mockResolvedValueOnce(null); // findBySlug for new slug check
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      await service.update(mockDomainId, updateDto);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'new-slug' },
      });
      expect(domainRepository.save).toHaveBeenCalled();
    });

    it('should check if new slug already exists before updating', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { slug: 'existing-slug' };
      const existingDomain = { ...mockDomain, slug: 'existing-slug', id: 'other-id' };
      // findOne é chamado duas vezes: uma em update (para buscar o domínio) e outra em findBySlug (para verificar slug)
      domainRepository.findOne
        .mockResolvedValueOnce(mockDomain) // findOne for domain (via update -> findOne)
        .mockResolvedValueOnce(existingDomain); // findBySlug for new slug check (via update -> findBySlug -> findOne)

      // Act & Assert
      const promise = service.update(mockDomainId, updateDto);
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow('Domain with slug "existing-slug" already exists');

      expect(domainRepository.save).not.toHaveBeenCalled();
    });

    it('should allow update without changing slug', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { name: 'Updated Name' };
      const updatedDomain = { ...mockDomain, name: 'Updated Name' };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(updatedDomain);

      // Act
      await service.update(mockDomainId, updateDto);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledTimes(1); // Only findOne, no findBySlug
      expect(domainRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when domain is not found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(mockDomainId, mockUpdateDomainDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(mockDomainId, mockUpdateDomainDto),
      ).rejects.toThrow(`Domain with ID "${mockDomainId}" not found`);

      expect(domainRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException with message containing the ID', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(mockDomainId, mockUpdateDomainDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(mockDomainId, mockUpdateDomainDto),
      ).rejects.toThrow(`Domain with ID "${mockDomainId}" not found`);
    });

    it('should throw ConflictException when new slug already exists', async () => {
      // Arrange
      const updateDto: UpdateDomainDto = { slug: 'existing-slug' };
      const existingDomain = { ...mockDomain, slug: 'existing-slug', id: 'other-id' };
      // findOne é chamado duas vezes: uma em update (para buscar o domínio) e outra em findBySlug (para verificar slug)
      domainRepository.findOne
        .mockResolvedValueOnce(mockDomain) // findOne for domain (via update -> findOne)
        .mockResolvedValueOnce(existingDomain); // findBySlug for new slug check (via update -> findBySlug -> findOne)

      // Act & Assert
      const promise = service.update(mockDomainId, updateDto);
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow('Domain with slug "existing-slug" already exists');
    });
  });

  describe('remove', () => {
    it('should deactivate domain when found (soft delete)', async () => {
      // Arrange
      const deactivatedDomain = { ...mockDomain, is_active: false };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(deactivatedDomain);

      // Act
      const result = await service.remove(mockDomainId);

      // Assert
      expect(result).toBe(true);
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });

    it('should call findOne to find domain', async () => {
      // Arrange
      const deactivatedDomain = { ...mockDomain, is_active: false };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(deactivatedDomain);

      // Act
      await service.remove(mockDomainId);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should set is_active to false', async () => {
      // Arrange
      const deactivatedDomain = { ...mockDomain, is_active: false };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(deactivatedDomain);

      // Act
      await service.remove(mockDomainId);

      // Assert
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });

    it('should call domainRepository.save with is_active=false', async () => {
      // Arrange
      const deactivatedDomain = { ...mockDomain, is_active: false };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(deactivatedDomain);

      // Act
      await service.remove(mockDomainId);

      // Assert
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });

    it('should return true when successful', async () => {
      // Arrange
      const deactivatedDomain = { ...mockDomain, is_active: false };
      domainRepository.findOne.mockResolvedValue(mockDomain);
      domainRepository.save.mockResolvedValue(deactivatedDomain);

      // Act
      const result = await service.remove(mockDomainId);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when domain is not found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(mockDomainId)).rejects.toThrow(NotFoundException);
      await expect(service.remove(mockDomainId)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );

      expect(domainRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException with message containing the ID', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(mockDomainId)).rejects.toThrow(NotFoundException);
      await expect(service.remove(mockDomainId)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );
    });
  });

  describe('activate', () => {
    it('should activate domain when found', async () => {
      // Arrange
      const inactiveDomain = { ...mockDomain, is_active: false };
      const activatedDomain = { ...mockDomain, is_active: true };
      domainRepository.findOne.mockResolvedValue(inactiveDomain);
      domainRepository.save.mockResolvedValue(activatedDomain);

      // Act
      const result = await service.activate(mockDomainId);

      // Assert
      expect(result).toBe(true);
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });

    it('should call findOne to find domain', async () => {
      // Arrange
      const inactiveDomain = { ...mockDomain, is_active: false };
      const activatedDomain = { ...mockDomain, is_active: true };
      domainRepository.findOne.mockResolvedValue(inactiveDomain);
      domainRepository.save.mockResolvedValue(activatedDomain);

      // Act
      await service.activate(mockDomainId);

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should set is_active to true', async () => {
      // Arrange
      const inactiveDomain = { ...mockDomain, is_active: false };
      const activatedDomain = { ...mockDomain, is_active: true };
      domainRepository.findOne.mockResolvedValue(inactiveDomain);
      domainRepository.save.mockResolvedValue(activatedDomain);

      // Act
      await service.activate(mockDomainId);

      // Assert
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });

    it('should call domainRepository.save with is_active=true', async () => {
      // Arrange
      const inactiveDomain = { ...mockDomain, is_active: false };
      const activatedDomain = { ...mockDomain, is_active: true };
      domainRepository.findOne.mockResolvedValue(inactiveDomain);
      domainRepository.save.mockResolvedValue(activatedDomain);

      // Act
      await service.activate(mockDomainId);

      // Assert
      expect(domainRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });

    it('should return true when successful', async () => {
      // Arrange
      const inactiveDomain = { ...mockDomain, is_active: false };
      const activatedDomain = { ...mockDomain, is_active: true };
      domainRepository.findOne.mockResolvedValue(inactiveDomain);
      domainRepository.save.mockResolvedValue(activatedDomain);

      // Act
      const result = await service.activate(mockDomainId);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when domain is not found', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.activate(mockDomainId)).rejects.toThrow(NotFoundException);
      await expect(service.activate(mockDomainId)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );

      expect(domainRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException with message containing the ID', async () => {
      // Arrange
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.activate(mockDomainId)).rejects.toThrow(NotFoundException);
      await expect(service.activate(mockDomainId)).rejects.toThrow(
        `Domain with ID "${mockDomainId}" not found`,
      );
    });
  });
});

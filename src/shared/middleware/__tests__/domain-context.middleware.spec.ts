import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DomainContextMiddleware } from '../domain-context.middleware';
import { Domain } from '../../../domains/domain/entities/domain.entity';
import { DomainContext } from '../../types/domain-context.types';

describe('DomainContextMiddleware', () => {
  let middleware: DomainContextMiddleware;
  let domainRepository: jest.Mocked<Repository<Domain>>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockDomainSlug = 'test-domain';
  const mockDomainName = 'Test Domain';

  const mockDomain: Domain = {
    id: mockDomainId,
    name: mockDomainName,
    slug: mockDomainSlug,
    description: 'Test description',
    is_active: true,
    created_by: 'admin-uuid',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    roles: [],
  } as Domain;

  const mockDomainContext: DomainContext = {
    domainId: mockDomainId,
    domainSlug: mockDomainSlug,
    domain: mockDomain,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainContextMiddleware,
        {
          provide: getRepositoryToken(Domain),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<DomainContextMiddleware>(DomainContextMiddleware);
    domainRepository = module.get(getRepositoryToken(Domain));

    // Setup mocks
    mockRequest = {
      headers: {},
      query: {},
      body: {},
    };

    mockResponse = {};

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('domain_id extraction', () => {
    it('should extract domain_id from x-domain-id header when present', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract domain_id from query parameter domain_id when header is not present', async () => {
      // Arrange
      mockRequest.headers = {};
      mockRequest.query = { domain_id: mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract domain_id from body when header and query are not present', async () => {
      // Arrange
      mockRequest.headers = {};
      mockRequest.query = {};
      mockRequest.body = { domain_id: mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prioritize header over query parameter', async () => {
      // Arrange
      const headerDomainId = 'header-domain-id';
      const queryDomainId = 'query-domain-id';
      mockRequest.headers = { 'x-domain-id': headerDomainId };
      mockRequest.query = { domain_id: queryDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: headerDomainId },
      });
      expect(domainRepository.findOne).not.toHaveBeenCalledWith({
        where: { id: queryDomainId },
      });
    });

    it('should prioritize query parameter over body', async () => {
      // Arrange
      const queryDomainId = 'query-domain-id';
      const bodyDomainId = 'body-domain-id';
      mockRequest.headers = {};
      mockRequest.query = { domain_id: queryDomainId };
      mockRequest.body = { domain_id: bodyDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: queryDomainId },
      });
      expect(domainRepository.findOne).not.toHaveBeenCalledWith({
        where: { id: bodyDomainId },
      });
    });

    it('should search domain by id when domain_id is extracted', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should inject domainContext in request when domain is found by id', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext).toEqual(mockDomainContext);
    });

    it('should call next() when domain is found by id', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('domain_slug extraction', () => {
    it('should extract domain_slug from x-domain-slug header when present', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockDomainSlug },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract domain_slug from query parameter domain_slug when header is not present', async () => {
      // Arrange
      mockRequest.headers = {};
      mockRequest.query = { domain_slug: mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockDomainSlug },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prioritize header over query parameter', async () => {
      // Arrange
      const headerSlug = 'header-slug';
      const querySlug = 'query-slug';
      mockRequest.headers = { 'x-domain-slug': headerSlug };
      mockRequest.query = { domain_slug: querySlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: headerSlug },
      });
      expect(domainRepository.findOne).not.toHaveBeenCalledWith({
        where: { slug: querySlug },
      });
    });

    it('should search domain by slug when domain_slug is extracted', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockDomainSlug },
      });
    });

    it('should inject domainContext in request when domain is found by slug', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext).toEqual(mockDomainContext);
    });

    it('should call next() when domain is found by slug', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('priority between domain_id and domain_slug', () => {
    it('should prioritize domain_id over domain_slug when both are present', async () => {
      // Arrange
      mockRequest.headers = {
        'x-domain-id': mockDomainId,
        'x-domain-slug': mockDomainSlug,
      };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
      expect(domainRepository.findOne).not.toHaveBeenCalledWith({
        where: { slug: mockDomainSlug },
      });
    });

    it('should use domain_slug only when domain_id is not present', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      mockRequest.query = {};
      mockRequest.body = {};
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockDomainSlug },
      });
    });
  });

  describe('domain lookup', () => {
    it('should call domainRepository.findOne with correct id when domain_id is present', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDomainId },
      });
    });

    it('should call domainRepository.findOne with correct slug when domain_slug is present', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(domainRepository.findOne).toHaveBeenCalledWith({
        where: { slug: mockDomainSlug },
      });
    });

    it('should inject domainContext with domainId, domainSlug and domain when found', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext).toBeDefined();
      expect(mockRequest.domainContext?.domainId).toBe(mockDomainId);
      expect(mockRequest.domainContext?.domainSlug).toBe(mockDomainSlug);
      expect(mockRequest.domainContext?.domain).toEqual(mockDomain);
    });

    it('should throw BadRequestException when domain is not found by id', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        'Domain context is required. Provide x-domain-id or x-domain-slug header, domain_id/domain_slug query param, or domain_id in body',
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when domain is not found by slug', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-slug': mockDomainSlug };
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        'Domain context is required. Provide x-domain-id or x-domain-slug header, domain_id/domain_slug query param, or domain_id in body',
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when neither domain_id nor domain_slug are provided', async () => {
      // Arrange
      mockRequest.headers = {};
      mockRequest.query = {};
      mockRequest.body = {};

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        'Domain context is required. Provide x-domain-id or x-domain-slug header, domain_id/domain_slug query param, or domain_id in body',
      );
      expect(domainRepository.findOne).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with correct message when domain is not found', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(
        'Domain context is required. Provide x-domain-id or x-domain-slug header, domain_id/domain_slug query param, or domain_id in body',
      );
    });
  });

  describe('domainContext injection', () => {
    it('should inject domainContext.domainId with id of found domain', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext?.domainId).toBe(mockDomainId);
    });

    it('should inject domainContext.domainSlug with slug of found domain', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext?.domainSlug).toBe(mockDomainSlug);
    });

    it('should inject domainContext.domain with complete Domain object', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext?.domain).toEqual(mockDomain);
    });

    it('should inject domainContext in request before calling next()', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockRequest.domainContext).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('next() call', () => {
    it('should call next() when domain is found and context is injected', async () => {
      // Arrange
      mockRequest.headers = { 'x-domain-id': mockDomainId };
      domainRepository.findOne.mockResolvedValue(mockDomain);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not call next() when BadRequestException is thrown', async () => {
      // Arrange
      mockRequest.headers = {};
      mockRequest.query = {};
      mockRequest.body = {};

      // Act & Assert
      await expect(
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

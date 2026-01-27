import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DomainIsolationMiddleware } from '../domain-isolation.middleware';
import { DomainContext } from '../../types/domain-context.types';
import { Domain } from '../../../domains/domain/entities/domain.entity';

describe('DomainIsolationMiddleware', () => {
  let middleware: DomainIsolationMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  // Test data
  const mockDomainId = 'domain-uuid';
  const mockOtherDomainId = 'other-domain-uuid';
  const mockDomainSlug = 'test-domain';
  const mockUserId = 'user-uuid';

  const mockDomain: Domain = {
    id: mockDomainId,
    name: 'Test Domain',
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
      providers: [DomainIsolationMiddleware],
    }).compile();

    middleware = module.get<DomainIsolationMiddleware>(
      DomainIsolationMiddleware,
    );

    // Setup mocks
    mockRequest = {};
    mockResponse = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('domainContext validation', () => {
    it('should throw ForbiddenException when domainContext is not present', () => {
      // Arrange
      mockRequest = {};

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with message "Domain context not found"', () => {
      // Arrange
      mockRequest = {};

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow('Domain context not found');
    });

    it('should not call next() when domainContext is absent', () => {
      // Arrange
      mockRequest = {};

      // Act & Assert
      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      } catch (error) {
        // Expected to throw
      }

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validation when no JWT token', () => {
    it('should pass when domainContext is present and there is no token (req.user does not exist)', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
    });

    it('should call next() when domainContext is present and there is no token', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
      };

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not throw exception when domainContext is present and there is no token', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
    });

    it('should pass when req.user exists but does not have domain_id', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when req.user.domain_id is undefined', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          sub: mockUserId,
          domain_id: undefined,
        } as any,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validation when JWT token matches domainContext', () => {
    it('should pass when domainContext.domainId matches req.user.domain_id', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
    });

    it('should call next() when domainContext.domainId matches req.user.domain_id', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not throw exception when domainContext.domainId matches req.user.domain_id', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).not.toThrow();
    });
  });

  describe('validation when JWT token does not match domainContext', () => {
    it('should throw ForbiddenException when token domain_id does not match domainContext.domainId', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockOtherDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with message "Token domain does not match request domain"', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockOtherDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow('Token domain does not match request domain');
    });

    it('should not call next() when token domain_id does not match domainContext.domainId', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockOtherDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      } catch (error) {
        // Expected to throw
      }

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('next() call', () => {
    it('should call next() when domainContext is present and there is no token', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
      };

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() when domainContext is present and token matches', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() without arguments when successful', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
      };

      // Act
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not call next() when ForbiddenException is thrown (domainContext absent)', () => {
      // Arrange
      mockRequest = {};

      // Act & Assert
      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      } catch (error) {
        // Expected to throw
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call next() when ForbiddenException is thrown (token does not match)', () => {
      // Arrange
      mockRequest = {
        domainContext: mockDomainContext,
        user: {
          domain_id: mockOtherDomainId,
          sub: mockUserId,
        } as any,
      };

      // Act & Assert
      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      } catch (error) {
        // Expected to throw
      }

      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

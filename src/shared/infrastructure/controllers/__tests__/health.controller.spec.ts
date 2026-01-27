import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;
  let redisClient: jest.Mocked<Redis>;

  // Test data
  const mockUptime = 12345.67;
  const mockDatabaseError = new Error('Database connection failed');
  const mockRedisError = new Error('Redis connection failed');

  beforeEach(async () => {
    // Mock DataSource
    dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any;

    // Mock Redis Client
    redisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
    } as any;

    // Mock process.uptime()
    jest.spyOn(process, 'uptime').mockReturnValue(mockUptime);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: redisClient,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    dataSource = module.get(DataSource);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('healthCheck', () => {
    it('should return object with status ok', async () => {
      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result).toHaveProperty('status', 'ok');
    });

    it('should return object with timestamp in ISO format', async () => {
      // Arrange
      const beforeCall = new Date().toISOString();

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result).toHaveProperty('timestamp');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      
      const afterCall = new Date().toISOString();
      expect(result.timestamp >= beforeCall && result.timestamp <= afterCall).toBe(true);
    });

    it('should return object with process uptime', async () => {
      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result).toHaveProperty('uptime', mockUptime);
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return correct response structure', async () => {
      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
      expect(Object.keys(result)).toEqual(['status', 'timestamp', 'uptime']);
    });
  });

  describe('detailedHealthCheck', () => {
    it('should return status ok when database and Redis are up', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.status).toBe('ok');
      expect(result.services.database).toBe('up');
      expect(result.services.redis).toBe('up');
    });

    it('should return status error when database is down', async () => {
      // Arrange
      dataSource.query.mockRejectedValue(mockDatabaseError);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.status).toBe('error');
      expect(result.services.database).toBe('down');
      expect(result.services.redis).toBe('up');
    });

    it('should return status error when Redis is down', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockRejectedValue(mockRedisError);

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.status).toBe('error');
      expect(result.services.database).toBe('up');
      expect(result.services.redis).toBe('down');
    });

    it('should return status error when database and Redis are down', async () => {
      // Arrange
      dataSource.query.mockRejectedValue(mockDatabaseError);
      redisClient.ping.mockRejectedValue(mockRedisError);

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.status).toBe('error');
      expect(result.services.database).toBe('down');
      expect(result.services.redis).toBe('down');
    });

    it('should return services.database as up when query succeeds', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.services.database).toBe('up');
    });

    it('should return services.database as down when query fails', async () => {
      // Arrange
      dataSource.query.mockRejectedValue(mockDatabaseError);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.services.database).toBe('down');
    });

    it('should return services.redis as up when ping succeeds', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.services.redis).toBe('up');
    });

    it('should return services.redis as down when ping fails', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockRejectedValue(mockRedisError);

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result.services.redis).toBe('down');
    });

    it('should return timestamp in ISO format', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');
      const beforeCall = new Date().toISOString();

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result).toHaveProperty('timestamp');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      
      const afterCall = new Date().toISOString();
      expect(result.timestamp >= beforeCall && result.timestamp <= afterCall).toBe(true);
    });

    it('should return process uptime', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result).toHaveProperty('uptime', mockUptime);
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should call dataSource.query with SELECT 1', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      await controller.detailedHealthCheck();

      // Assert
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should call redisClient.ping', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      await controller.detailedHealthCheck();

      // Assert
      expect(redisClient.ping).toHaveBeenCalled();
    });

    it('should return correct response structure with services', async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      redisClient.ping.mockResolvedValue('PONG');

      // Act
      const result = await controller.detailedHealthCheck();

      // Assert
      expect(result).toEqual({
        status: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        services: {
          database: expect.any(String),
          redis: expect.any(String),
        },
      });
      expect(Object.keys(result)).toEqual(['status', 'timestamp', 'uptime', 'services']);
      expect(Object.keys(result.services)).toEqual(['database', 'redis']);
      expect(['up', 'down']).toContain(result.services.database);
      expect(['up', 'down']).toContain(result.services.redis);
    });
  });
});

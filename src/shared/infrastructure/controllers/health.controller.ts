import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check básico' })
  @ApiResponse({ status: 200, description: 'Serviço está funcionando' })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Health check detalhado' })
  @ApiResponse({ status: 200, description: 'Status detalhado dos serviços' })
  async detailedHealthCheck() {
    const services = {
      database: 'down' as 'up' | 'down',
      redis: 'down' as 'up' | 'down',
    };

    // Verificar conexão com banco de dados
    try {
      await this.dataSource.query('SELECT 1');
      services.database = 'up';
    } catch (error) {
      services.database = 'down';
    }

    // Verificar conexão com Redis
    try {
      await this.redisClient.ping();
      services.redis = 'up';
    } catch (error) {
      services.redis = 'down';
    }

    const allServicesUp = services.database === 'up' && services.redis === 'up';

    return {
      status: allServicesUp ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
    };
  }
}

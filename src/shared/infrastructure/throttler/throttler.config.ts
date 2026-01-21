import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

export const throttlerConfig = (configService: ConfigService): ThrottlerModuleOptions => {
  const isDevelopment = configService.get<string>('NODE_ENV') === 'development';
  
  return {
    throttlers: [
      {
        name: 'default',
        // Em desenvolvimento: limite mais alto para facilitar testes
        // Em produção: limite mais restritivo
        ttl: parseInt(configService.get<string>('RATE_LIMIT_WINDOW_MS', '900000'), 10),
        limit: isDevelopment 
          ? parseInt(configService.get<string>('RATE_LIMIT_MAX_REQUESTS_DEV', '1000'), 10)
          : parseInt(configService.get<string>('RATE_LIMIT_MAX_REQUESTS', '5'), 10),
      },
      {
        name: 'login',
        ttl: 15 * 60 * 1000, // 15 minutos
        limit: 5,
      },
      {
        name: 'register',
        ttl: 60 * 60 * 1000, // 1 hora
        limit: 3,
      },
      {
        name: 'domains',
        ttl: 60 * 1000, // 1 minuto
        limit: 100,
      },
    ],
  };
};

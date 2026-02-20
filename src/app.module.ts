import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from '../typeorm.config';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { DomainContextMiddleware } from './shared/middleware/domain-context.middleware';
import { Domain } from './domains/domain/entities/domain.entity';
import { DomainRole } from './domains/domain/entities/domain-role.entity';
import { DomainsModule } from './domains/domains.module';
import { AppThrottlerModule } from './shared/infrastructure/throttler/throttler.module';
import { ThrottlerDomainGuard } from './shared/infrastructure/throttler/throttler-domain.guard';
import { HealthController } from './shared/infrastructure/controllers/health.controller';
import { UsersModule } from './users/users.module';
import { LoggerModule } from './shared/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forFeature([Domain, DomainRole]),
    RedisModule,
    DomainsModule,
    UsersModule,
    AppThrottlerModule,
    // Other modules can be imported here
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerDomainGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar Domain Context Middleware globalmente, exceto em:
    // - Health checks (não precisam de domain context)
    // - POST /domains: criação do primeiro domínio (não há domain ainda)
    // GET /domains requer domain context para filtrar/listar domínios no contexto do tenant
    consumer
      .apply(DomainContextMiddleware)
      .exclude(
        'health',
        'health/(.*)',
        { path: 'domains', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}

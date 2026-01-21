import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from '../typeorm.config';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { DomainContextMiddleware } from './shared/middleware/domain-context.middleware';
import { Domain } from './domains/domain/entities/domain.entity';
import { DomainRole } from './domains/domain/entities/domain-role.entity';
import { DomainsModule } from './domains/domains.module';
import { AppThrottlerModule } from './shared/infrastructure/throttler/throttler.module';
import { ThrottlerDomainGuard } from './shared/infrastructure/throttler/throttler-domain.guard';
import { HealthController } from './shared/infrastructure/controllers/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forFeature([Domain, DomainRole]),
    RedisModule,
    DomainsModule,
    AppThrottlerModule,
    // Other modules can be imported here
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
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

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from '../typeorm.config';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { DomainContextMiddleware } from './shared/middleware/domain-context.middleware';
import { Domain } from './domains/domain/entities/domain.entity';
import { DomainRole } from './domains/domain/entities/domain-role.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forFeature([Domain, DomainRole]),
    RedisModule,
    // Other modules can be imported here
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Domain Context Middleware pode ser aplicado globalmente ou em rotas específicas
    // Por enquanto, vamos aplicar apenas em rotas que precisam de domain context
    // consumer.apply(DomainContextMiddleware).forRoutes('*');
  }
}

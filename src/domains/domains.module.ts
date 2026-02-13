import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Domain } from './domain/entities/domain.entity';
import { DomainRole } from './domain/entities/domain-role.entity';
import { DomainController } from './infrastructure/controllers/domain.controller';
import { DomainRoleController } from './infrastructure/controllers/domain-role.controller';
import { DomainService } from './application/services/domain-service/domain.service';
import { DomainRoleService } from './application/services/domain-role-service/domain-role.service';
import { DomainRepository } from './infrastructure/repositories/domain.repository';
import { DomainRoleRepository } from './infrastructure/repositories/domain-role.repository';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Domain, DomainRole]), UsersModule],
  controllers: [DomainController, DomainRoleController],
  providers: [
    DomainService,
    DomainRoleService,
    DomainRepository,
    DomainRoleRepository,
    {
      provide: 'IDomainRoleRepository',
      useClass: DomainRoleRepository,
    },
  ],
  exports: [DomainService, DomainRoleRepository, 'IDomainRoleRepository'],
})
export class DomainsModule {}

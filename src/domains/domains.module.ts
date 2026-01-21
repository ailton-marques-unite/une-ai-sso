import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Domain } from './domain/entities/domain.entity';
import { DomainRole } from './domain/entities/domain-role.entity';
import { DomainController } from './infrastructure/controllers/domain.controller';
import { DomainService } from './application/services/domain-service/domain.service';
import { DomainRepository } from './infrastructure/repositories/domain.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Domain, DomainRole])],
  controllers: [DomainController],
  providers: [DomainService, DomainRepository],
  exports: [DomainService],
})
export class DomainsModule {}

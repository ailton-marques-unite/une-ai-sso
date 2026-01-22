import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Domain } from '../../domain/entities/domain.entity';
import { IDomainRepository } from '../../domain/repositories/domain.repository.interface';

@Injectable()
export class DomainRepository implements IDomainRepository {
  constructor(
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
  ) {}

  async findBySlug(slug: string): Promise<Domain | null> {
    return this.domainRepository.findOne({
      where: { slug },
    });
  }

  async findActiveDomains(options?: FindManyOptions<Domain>): Promise<Domain[]> {
    return this.domainRepository.find({
      ...options,
      where: {
        is_active: true,
        ...(options?.where as any),
      },
    });
  }

  async findById(id: string): Promise<Domain | null> {
    return this.domainRepository.findOne({
      where: { id },
    });
  }

  async findByMsTenantId(msTenantId: string): Promise<Domain | null> {
    return this.domainRepository.findOne({
      where: { ms_tenant_id: msTenantId, is_active: true },
    });
  }

  async create(domain: Partial<Domain>): Promise<Domain> {
    const newDomain = this.domainRepository.create(domain);
    return this.domainRepository.save(newDomain);
  }

  async update(id: string, domain: Partial<Domain>): Promise<Domain | null> {
    const existingDomain = await this.findById(id);
    if (!existingDomain) {
      return null;
    }

    Object.assign(existingDomain, domain);
    return this.domainRepository.save(existingDomain);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.domainRepository.update(id, { is_active: false });
    return (result.affected || 0) > 0;
  }

  async activate(id: string): Promise<boolean> {
    const result = await this.domainRepository.update(id, { is_active: true });
    return (result.affected || 0) > 0;
  }
}

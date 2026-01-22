import { Domain } from '../entities/domain.entity';
import { FindManyOptions } from 'typeorm';

export interface IDomainRepository {
  findBySlug(slug: string): Promise<Domain | null>;
  findActiveDomains(options?: FindManyOptions<Domain>): Promise<Domain[]>;
  findById(id: string): Promise<Domain | null>;
  create(domain: Partial<Domain>): Promise<Domain>;
  update(id: string, domain: Partial<Domain>): Promise<Domain | null>;
  softDelete(id: string): Promise<boolean>;
  activate(id: string): Promise<boolean>;
}

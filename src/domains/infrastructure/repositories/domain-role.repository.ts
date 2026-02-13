import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainRole } from '../../domain/entities/domain-role.entity';
import {
  CreateDomainRoleProps,
  IDomainRoleRepository,
  UpdateDomainRoleProps,
} from '../../domain/repositories/domain-role.repository.interface';

@Injectable()
export class DomainRoleRepository implements IDomainRoleRepository {
  constructor(
    @InjectRepository(DomainRole)
    private readonly repository: Repository<DomainRole>,
  ) {}

  async findById(domainRoleId: string): Promise<DomainRole | null> {
    return this.repository.findOne({ where: { id: domainRoleId } });
  }

  async findRolesByDomainId(domainId: string): Promise<DomainRole[]> {
    return this.repository.find({
      where: { domain_id: domainId },
      order: { created_at: 'DESC' },
    });
  }

  async existsByName(domainId: string, name: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { domain_id: domainId, name },
    });
    return count > 0;
  }

  async createRole(props: CreateDomainRoleProps): Promise<DomainRole> {
    const entity = this.repository.create({
      domain_id: props.domainId,
      name: props.name,
      description: props.description,
      permissions: props.permissions,
    });

    return this.repository.save(entity);
  }

  async updateRole(
    domainRoleId: string,
    props: UpdateDomainRoleProps,
  ): Promise<DomainRole> {
    const existing = await this.findById(domainRoleId);
    if (!existing) {
      throw new Error('DomainRole not found');
    }

    Object.assign(existing, {
      name: props.name ?? existing.name,
      description: props.description ?? existing.description,
      permissions: props.permissions ?? existing.permissions,
    });

    return this.repository.save(existing);
  }

  async deleteRole(domainRoleId: string): Promise<void> {
    await this.repository.delete({ id: domainRoleId });
  }
}


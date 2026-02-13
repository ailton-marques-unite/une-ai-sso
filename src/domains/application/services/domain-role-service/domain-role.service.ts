import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { DomainRole } from '../../../domain/entities/domain-role.entity';
import { Domain } from '../../../domain/entities/domain.entity';
import { CreateDomainRoleDto } from '../../dtos/create-domain-role.dto';
import { UpdateDomainRoleDto } from '../../dtos/update-domain-role.dto';
import { ListDomainRolesQueryDto } from '../../dtos/list-domain-roles-query.dto';

@Injectable()
export class DomainRoleService {
  constructor(
    @InjectRepository(DomainRole)
    private readonly domainRoleRepository: Repository<DomainRole>,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
  ) {}

  async createDomainRole(
    domainId: string,
    createDomainRoleDto: CreateDomainRoleDto,
  ): Promise<DomainRole> {
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    const existingRole = await this.domainRoleRepository.findOne({
      where: {
        domain_id: domainId,
        name: createDomainRoleDto.name,
      },
    });

    if (existingRole) {
      throw new ConflictException(
        `Role with name "${createDomainRoleDto.name}" already exists in this domain`,
      );
    }

    const domainRole = this.domainRoleRepository.create({
      domain_id: domainId,
      name: createDomainRoleDto.name,
      description: createDomainRoleDto.description,
      permissions: createDomainRoleDto.permissions,
    });

    return this.domainRoleRepository.save(domainRole);
  }

  async listDomainRoles(
    domainId: string,
    query: ListDomainRolesQueryDto,
  ): Promise<{
    data: DomainRole[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      domain_id: domainId,
    };

    if (search) {
      where.name = Like(`%${search}%`);
    }

    const [data, total] = await this.domainRoleRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getDomainRoleById(
    domainId: string,
    roleId: string,
  ): Promise<DomainRole> {
    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async updateDomainRole(
    domainId: string,
    roleId: string,
    updateDomainRoleDto: UpdateDomainRoleDto,
  ): Promise<DomainRole> {
    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (
      updateDomainRoleDto.name &&
      updateDomainRoleDto.name !== role.name
    ) {
      const existingRole = await this.domainRoleRepository.findOne({
        where: {
          domain_id: domainId,
          name: updateDomainRoleDto.name,
        },
      });

      if (existingRole) {
        throw new ConflictException(
          `Role with name "${updateDomainRoleDto.name}" already exists in this domain`,
        );
      }
    }

    Object.assign(role, updateDomainRoleDto);
    return this.domainRoleRepository.save(role);
  }

  async deleteDomainRole(domainId: string, roleId: string): Promise<void> {
    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.domainRoleRepository.remove(role);
  }
}


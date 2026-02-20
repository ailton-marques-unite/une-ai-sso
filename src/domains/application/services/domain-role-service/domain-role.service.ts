import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { DomainRole } from '../../../domain/entities/domain-role.entity';
import { Domain } from '../../../domain/entities/domain.entity';
import { CreateDomainRoleDto } from '../../dtos/create-domain-role.dto';
import { UpdateDomainRoleDto } from '../../dtos/update-domain-role.dto';
import { ListDomainRolesQueryDto } from '../../dtos/list-domain-roles-query.dto';
import { AppLogger, APP_LOGGER } from '../../../../shared/utils/logger';

@Injectable()
export class DomainRoleService {
  private readonly context = DomainRoleService.name;

  constructor(
    @InjectRepository(DomainRole)
    private readonly domainRoleRepository: Repository<DomainRole>,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  async createDomainRole(
    domainId: string,
    createDomainRoleDto: CreateDomainRoleDto,
  ): Promise<DomainRole> {
    this.logger.log('createDomainRole started', this.context, domainId);
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

    const saved = await this.domainRoleRepository.save(domainRole);
    this.logger.log('createDomainRole completed', this.context, domainId);
    return saved;
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
    this.logger.log('listDomainRoles started', this.context, domainId);
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

    this.logger.log('listDomainRoles completed', this.context, domainId);
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
    this.logger.debug('getDomainRoleById started', this.context, domainId);
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
    this.logger.log('updateDomainRole started', this.context, domainId);
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
    const saved = await this.domainRoleRepository.save(role);
    this.logger.log('updateDomainRole completed', this.context, domainId);
    return saved;
  }

  async deleteDomainRole(domainId: string, roleId: string): Promise<void> {
    this.logger.log('deleteDomainRole started', this.context, domainId);
    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.domainRoleRepository.remove(role);
    this.logger.log('deleteDomainRole completed', this.context, domainId);
  }
}


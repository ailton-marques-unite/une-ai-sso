import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../domain/entities/user-role.entity';
import { User } from '../../../domain/entities/user.entity';
import { DomainRole } from '../../../../domains/domain/entities/domain-role.entity';
import { AssignUserRoleDto } from '../../dtos/assign-user-role.dto';
import { ListUserRolesQueryDto } from '../../dtos/list-user-roles-query.dto';
import { AppLogger, APP_LOGGER } from '../../../../shared/utils/logger';

@Injectable()
export class UserRoleService {
  private readonly context = UserRoleService.name;

  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DomainRole)
    private readonly domainRoleRepository: Repository<DomainRole>,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  async listUserRoles(
    domainId: string,
    userId: string,
    query: ListUserRolesQueryDto,
  ): Promise<UserRole[]> {
    this.logger.log('listUserRoles started', this.context, domainId);
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
      relations: ['roles', 'roles.role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Paginação simples em memória; pode ser otimizada com query direta em UserRole
    const { page = 1, limit = 10, domainId: filterDomainId } = query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const filteredRoles =
      filterDomainId && user.roles
        ? user.roles.filter(
            (userRole) => userRole.role?.domain_id === filterDomainId,
          )
        : user.roles ?? [];

    this.logger.log('listUserRoles completed', this.context, domainId);
    return filteredRoles.slice(startIndex, endIndex);
  }

  async assignRoleToUser(
    domainId: string,
    userId: string,
    assignUserRoleDto: AssignUserRoleDto,
  ): Promise<UserRole> {
    this.logger.log('assignRoleToUser started', this.context, domainId);
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.domainRoleRepository.findOne({
      where: { id: assignUserRoleDto.domainRoleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existingUserRole = await this.userRoleRepository.findOne({
      where: {
        user_id: userId,
        role_id: assignUserRoleDto.domainRoleId,
      },
    });

    if (existingUserRole) {
      throw new ConflictException(
        'User already has this role assigned in this domain',
      );
    }

    const userRole = this.userRoleRepository.create({
      user_id: userId,
      role_id: assignUserRoleDto.domainRoleId,
    });

    const saved = await this.userRoleRepository.save(userRole);
    this.logger.log('assignRoleToUser completed', this.context, domainId);
    return saved;
  }

  async removeRoleFromUser(
    domainId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    this.logger.log('removeRoleFromUser started', this.context, domainId);
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const result = await this.userRoleRepository.delete({
      user_id: userId,
      role_id: roleId,
    });

    if (result.affected === 0) {
      this.logger.warn('removeRoleFromUser: association not found', this.context, domainId);
      throw new NotFoundException('User role association not found');
    }
    this.logger.log('removeRoleFromUser completed', this.context, domainId);
  }
}


import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../domain/entities/user-role.entity';
import { DomainRole } from '../../../../domains/domain/entities/domain-role.entity';
import { User } from '../../../domain/entities/user.entity';

export interface UserRolesAndPermissions {
  roles: string[];
  permissions: string[];
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(DomainRole)
    private readonly domainRoleRepository: Repository<DomainRole>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUserRolesAndPermissions(
    domainId: string,
    userId: string,
  ): Promise<UserRolesAndPermissions> {
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
      relations: ['roles', 'roles.role'],
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const roles: string[] = [];
    const permissionsSet = new Set<string>();

    if (user.roles && user.roles.length > 0) {
      for (const userRole of user.roles) {
        if (userRole.role) {
          roles.push(userRole.role.name);
          if (userRole.role.permissions) {
            userRole.role.permissions.forEach((perm) =>
              permissionsSet.add(perm),
            );
          }
        }
      }
    }

    return {
      roles,
      permissions: Array.from(permissionsSet),
    };
  }

  async assignRoleToUser(
    domainId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    // Verificar se usuário existe e pertence ao domínio
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se role existe e pertence ao domínio
    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role não encontrada');
    }

    // Verificar se já existe a associação
    const existing = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId },
    });

    if (existing) {
      return; // Já está associado
    }

    // Criar associação
    const userRole = this.userRoleRepository.create({
      user_id: userId,
      role_id: roleId,
    });

    await this.userRoleRepository.save(userRole);
  }

  async removeRoleFromUser(
    domainId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    // Verificar se usuário e role pertencem ao domínio
    const user = await this.userRepository.findOne({
      where: { id: userId, domain_id: domainId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const role = await this.domainRoleRepository.findOne({
      where: { id: roleId, domain_id: domainId },
    });

    if (!role) {
      throw new NotFoundException('Role não encontrada');
    }

    await this.userRoleRepository.delete({
      user_id: userId,
      role_id: roleId,
    });
  }

  async hasPermission(
    domainId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const { permissions } = await this.getUserRolesAndPermissions(
      domainId,
      userId,
    );
    return permissions.includes(permission);
  }

  async hasRole(
    domainId: string,
    userId: string,
    role: string,
  ): Promise<boolean> {
    const { roles } = await this.getUserRolesAndPermissions(domainId, userId);
    return roles.includes(role);
  }

  async requirePermission(
    domainId: string,
    userId: string,
    permission: string,
  ): Promise<void> {
    const hasPermission = await this.hasPermission(
      domainId,
      userId,
      permission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Permissão necessária: ${permission}`,
      );
    }
  }

  async requireRole(
    domainId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    const hasRole = await this.hasRole(domainId, userId, role);

    if (!hasRole) {
      throw new ForbiddenException(`Role necessária: ${role}`);
    }
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserRoleService } from '../user-role-service/user-role.service';

export interface UserRolesAndPermissions {
  roles: string[];
  permissions: string[];
}

@Injectable()
export class RbacService {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly userRoleService: UserRoleService,
  ) {}

  async getUserRolesAndPermissions(
    domainId: string,
    userId: string,
  ): Promise<UserRolesAndPermissions> {
    const user = await this.userRepository.findById(domainId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
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
    await this.userRoleService.assignRoleToUser(domainId, userId, {
      domainRoleId: roleId,
    });
  }

  async removeRoleFromUser(
    domainId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    await this.userRoleService.removeRoleFromUser(domainId, userId, roleId);
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
        `Permission required: ${permission}`,
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
      throw new ForbiddenException(`Role required: ${role}`);
    }
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserRoleService } from '../user-role-service/user-role.service';
import { AppLogger, APP_LOGGER } from '../../../../shared/utils/logger';

export interface UserRolesAndPermissions {
  roles: string[];
  permissions: string[];
}

@Injectable()
export class RbacService {
  private readonly context = RbacService.name;

  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly userRoleService: UserRoleService,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  async getUserRolesAndPermissions(
    domainId: string,
    userId: string,
  ): Promise<UserRolesAndPermissions> {
    this.logger.log('getUserRolesAndPermissions started', this.context, domainId);
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

    this.logger.log('getUserRolesAndPermissions completed', this.context, domainId);
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
    this.logger.log('assignRoleToUser started', this.context, domainId);
    await this.userRoleService.assignRoleToUser(domainId, userId, {
      domainRoleId: roleId,
    });
    this.logger.log('assignRoleToUser completed', this.context, domainId);
  }

  async removeRoleFromUser(
    domainId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    this.logger.log('removeRoleFromUser started', this.context, domainId);
    await this.userRoleService.removeRoleFromUser(domainId, userId, roleId);
    this.logger.log('removeRoleFromUser completed', this.context, domainId);
  }

  async hasPermission(
    domainId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    this.logger.debug('hasPermission started', this.context, domainId);
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
    this.logger.debug('hasRole started', this.context, domainId);
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

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacService } from '../../users/application/services/rbac-service/rbac.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se não há roles ou permissions requeridas, permitir acesso
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const domainId = request.domainContext?.domainId;
    const userId = request.user?.sub;

    if (!domainId || !userId) {
      throw new ForbiddenException('Domain context e usuário são obrigatórios');
    }

    // Verificar roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = await Promise.all(
        requiredRoles.map((role) =>
          this.rbacService.hasRole(domainId, userId, role),
        ),
      );

      if (!hasRequiredRole.some((has) => has)) {
        throw new ForbiddenException(
          `Roles necessárias: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Verificar permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasRequiredPermission = await Promise.all(
        requiredPermissions.map((permission) =>
          this.rbacService.hasPermission(domainId, userId, permission),
        ),
      );

      if (!hasRequiredPermission.some((has) => has)) {
        throw new ForbiddenException(
          `Permissões necessárias: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}

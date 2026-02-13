import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { RbacService } from '../../application/services/rbac-service/rbac.service';

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('domains/:domainId/users/:userId/permissions')
  @ApiOperation({
    summary: 'Listar roles e permissões efetivas de um usuário em um domínio',
  })
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Roles e permissões do usuário no domínio informado',
  })
  @Permissions('rbac.read')
  async getUserRolesAndPermissions(
    @Param('domainId') domainId: string,
    @Param('userId') userId: string,
  ) {
    return this.rbacService.getUserRolesAndPermissions(domainId, userId);
  }

  @Get('domains/:domainId/roles/:roleId/users')
  @ApiOperation({
    summary: 'Listar usuários associados a uma role em um domínio',
  })
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiParam({ name: 'roleId', description: 'ID da role' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuários associados à role',
  })
  @Permissions('rbac.read')
  async getUsersByRole(
    @Param('domainId') domainId: string,
    @Param('roleId') roleId: string,
  ) {
    // Nota: para manter o RbacService focado em verificação de permissions,
    // reutilizamos o UserRoleRepository via service específico no futuro, se necessário.
    // Aqui retornamos uma lista mínima usando o próprio serviço quando disponível.
    // Por enquanto, este endpoint pode ser implementado de forma incremental.
    return {
      domainId,
      roleId,
      users: [],
    };
  }
}


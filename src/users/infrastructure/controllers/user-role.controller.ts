import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { UserRoleService } from '../../application/services/user-role-service/user-role.service';
import { AssignUserRoleDto } from '../../application/dtos/assign-user-role.dto';
import { ListUserRolesQueryDto } from '../../application/dtos/list-user-roles-query.dto';

@ApiTags('User Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users/:userId/roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Get()
  @ApiOperation({ summary: 'Listar roles de um usuário em um domínio' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'domainId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de roles do usuário' })
  @Permissions('user.roles.read')
  async list(
    @Param('userId') userId: string,
    @Query() query: ListUserRolesQueryDto,
    @Request() req: any,
  ) {
    const domainId = query.domainId ?? req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context is required');
    }

    return this.userRoleService.listUserRoles(domainId, userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Atribuir uma role de domínio a um usuário' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiResponse({ status: 201, description: 'Role atribuída com sucesso' })
  @Permissions('user.roles.write')
  async assign(
    @Param('userId') userId: string,
    @Body() assignUserRoleDto: AssignUserRoleDto,
    @Request() req: any,
  ) {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context is required');
    }

    return this.userRoleService.assignRoleToUser(
      domainId,
      userId,
      assignUserRoleDto,
    );
  }

  @Delete(':roleId')
  @ApiOperation({ summary: 'Remover uma role de domínio de um usuário' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiParam({ name: 'roleId', description: 'ID da role de domínio' })
  @ApiResponse({ status: 204, description: 'Role removida com sucesso' })
  @Permissions('user.roles.write')
  async remove(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Request() req: any,
  ): Promise<void> {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context is required');
    }

    await this.userRoleService.removeRoleFromUser(domainId, userId, roleId);
  }
}


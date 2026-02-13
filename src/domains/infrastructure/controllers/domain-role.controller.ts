import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { DomainRoleService } from '../../application/services/domain-role-service/domain-role.service';
import { CreateDomainRoleDto } from '../../application/dtos/create-domain-role.dto';
import { UpdateDomainRoleDto } from '../../application/dtos/update-domain-role.dto';
import { ListDomainRolesQueryDto } from '../../application/dtos/list-domain-roles-query.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Permissions } from '../../../shared/decorators/permissions.decorator';

@ApiTags('Domain Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('domains/:domainId/roles')
export class DomainRoleController {
  constructor(private readonly domainRoleService: DomainRoleService) {}

  @Get()
  @ApiOperation({ summary: 'Listar roles de um domínio' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de roles do domínio' })
  @Permissions('domain.roles.read')
  async list(
    @Param('domainId') domainId: string,
    @Query() query: ListDomainRolesQueryDto,
  ) {
    return this.domainRoleService.listDomainRoles(domainId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Criar uma nova role em um domínio' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiResponse({ status: 201, description: 'Role criada com sucesso' })
  @Permissions('domain.roles.write')
  async create(
    @Param('domainId') domainId: string,
    @Body() createDomainRoleDto: CreateDomainRoleDto,
  ) {
    return this.domainRoleService.createDomainRole(
      domainId,
      createDomainRoleDto,
    );
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Obter detalhes de uma role de domínio' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiParam({ name: 'roleId', description: 'ID da role' })
  @ApiResponse({ status: 200, description: 'Role encontrada' })
  @Permissions('domain.roles.read')
  async getById(
    @Param('domainId') domainId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.domainRoleService.getDomainRoleById(domainId, roleId);
  }

  @Patch(':roleId')
  @ApiOperation({ summary: 'Atualizar uma role de domínio' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiParam({ name: 'roleId', description: 'ID da role' })
  @ApiResponse({ status: 200, description: 'Role atualizada com sucesso' })
  @Permissions('domain.roles.write')
  async update(
    @Param('domainId') domainId: string,
    @Param('roleId') roleId: string,
    @Body() updateDomainRoleDto: UpdateDomainRoleDto,
  ) {
    return this.domainRoleService.updateDomainRole(
      domainId,
      roleId,
      updateDomainRoleDto,
    );
  }

  @Delete(':roleId')
  @ApiOperation({ summary: 'Remover uma role de domínio' })
  @ApiSecurity('domain-slug')
  @ApiParam({ name: 'domainId', description: 'ID do domínio' })
  @ApiParam({ name: 'roleId', description: 'ID da role' })
  @ApiResponse({ status: 204, description: 'Role removida com sucesso' })
  @Permissions('domain.roles.write')
  async delete(
    @Param('domainId') domainId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.domainRoleService.deleteDomainRole(domainId, roleId);
  }
}


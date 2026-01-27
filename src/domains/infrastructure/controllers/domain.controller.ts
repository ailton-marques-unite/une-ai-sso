import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DomainService } from '../../application/services/domain-service/domain.service';
import { CreateDomainDto } from '../../application/dtos/create-domain.dto';
import { UpdateDomainDto } from '../../application/dtos/update-domain.dto';
import { ListDomainsQueryDto } from '../../application/dtos/list-domains-query.dto';
import { DomainResponseDto } from '../../application/dtos/domain-response.dto';

@ApiTags('Domains')
@Controller('domains')
@Throttle({ default: { limit: 1000, ttl: 60000 } }) // Limite alto para desenvolvimento: 1000 req/minuto
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new domain' })
  @ApiResponse({
    status: 201,
    description: 'Domain created successfully',
    type: DomainResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  @ApiBearerAuth()
  async create(@Body() createDomainDto: CreateDomainDto): Promise<DomainResponseDto> {
    // TODO: Obter created_by do token JWT quando autenticação estiver implementada
    // Por enquanto, usamos um UUID fixo para o sistema até que a autenticação seja implementada
    // Em produção, isso deve ser obtido do token JWT do usuário autenticado
    const createdBy = process.env.SYSTEM_USER_ID || randomUUID();
    const domain = await this.domainService.create(createDomainDto, createdBy);
    return domain as DomainResponseDto;
  }

  @Get()
  @ApiOperation({ summary: 'Listar domínios' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Lista de domínios',
    type: [DomainResponseDto],
  })
  async findAll(@Query() query: ListDomainsQueryDto) {
    return this.domainService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter domínio por ID' })
  @ApiParam({ name: 'id', description: 'ID do domínio' })
  @ApiResponse({
    status: 200,
    description: 'Domínio encontrado',
    type: DomainResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Domain not found' })
  async findOne(@Param('id') id: string): Promise<DomainResponseDto> {
    const domain = await this.domainService.findOne(id);
    if (!domain) {
      throw new Error('Domain not found'); // Será tratado pelo exception filter
    }
    return domain as DomainResponseDto;
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Obter domínio por slug' })
  @ApiParam({ name: 'slug', description: 'Slug do domínio' })
  @ApiResponse({
    status: 200,
    description: 'Domain found',
    type: DomainResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Domínio não encontrado' })
  async findBySlug(@Param('slug') slug: string): Promise<DomainResponseDto> {
    const domain = await this.domainService.findBySlug(slug);
    if (!domain) {
      throw new Error('Domain not found');
    }
    return domain as DomainResponseDto;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar domínio' })
  @ApiParam({ name: 'id', description: 'ID do domínio' })
  @ApiResponse({
    status: 200,
    description: 'Domain updated successfully',
    type: DomainResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Domínio não encontrado' })
  @ApiResponse({ status: 409, description: 'Slug já existe' })
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDomainDto: UpdateDomainDto,
  ): Promise<DomainResponseDto> {
    const domain = await this.domainService.update(id, updateDomainDto);
    if (!domain) {
      throw new Error('Domain not found');
    }
    return domain as DomainResponseDto;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar domínio (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID do domínio' })
  @ApiResponse({ status: 204, description: 'Domínio desativado com sucesso' })
  @ApiResponse({ status: 404, description: 'Domínio não encontrado' })
  @ApiBearerAuth()
  async remove(@Param('id') id: string): Promise<void> {
    await this.domainService.remove(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Reativar domínio' })
  @ApiParam({ name: 'id', description: 'ID do domínio' })
  @ApiResponse({
    status: 200,
    description: 'Domínio reativado com sucesso',
    type: DomainResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Domínio não encontrado' })
  @ApiBearerAuth()
  async activate(@Param('id') id: string): Promise<DomainResponseDto> {
    await this.domainService.activate(id);
    const domain = await this.domainService.findOne(id);
    if (!domain) {
      throw new Error('Domain not found');
    }
    return domain as DomainResponseDto;
  }
}

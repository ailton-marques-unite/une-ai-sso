import { ApiProperty } from '@nestjs/swagger';

export class DomainResponseDto {
  @ApiProperty({ description: 'ID único do domínio', example: 'uuid-123' })
  id: string;

  @ApiProperty({ description: 'Nome do domínio', example: 'Minha Empresa' })
  name: string;

  @ApiProperty({ description: 'Slug do domínio', example: 'minha-empresa' })
  slug: string;

  @ApiProperty({
    description: 'Descrição do domínio',
    example: 'Domínio principal da empresa',
    required: false,
  })
  description?: string;

  @ApiProperty({ description: 'Status ativo/inativo', example: true })
  is_active: boolean;

  @ApiProperty({ description: 'ID do usuário que criou o domínio', example: 'uuid-456' })
  created_by: string;

  @ApiProperty({ description: 'Data de criação', example: '2026-01-21T10:00:00Z' })
  created_at: Date;

  @ApiProperty({ description: 'Data de atualização', example: '2026-01-21T10:00:00Z' })
  updated_at: Date;
}

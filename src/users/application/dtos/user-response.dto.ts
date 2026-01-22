import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'ID do usuário', example: 'uuid-123' })
  id: string;

  @ApiProperty({ description: 'Email do usuário', example: 'usuario@example.com' })
  email: string;

  @ApiPropertyOptional({ description: 'Nome completo', example: 'João Silva' })
  full_name?: string;

  @ApiPropertyOptional({ description: 'Telefone', example: '+5511999999999' })
  phone?: string;

  @ApiProperty({ description: 'Usuário está ativo', example: true })
  is_active: boolean;

  @ApiProperty({ description: 'Email verificado', example: false })
  is_verified: boolean;

  @ApiProperty({ description: 'MFA habilitado', example: false })
  mfa_enabled: boolean;

  @ApiPropertyOptional({ description: 'Último login', example: '2024-01-01T00:00:00Z' })
  last_login_at?: Date;

  @ApiProperty({ description: 'Data de criação', example: '2024-01-01T00:00:00Z' })
  created_at: Date;

  @ApiProperty({ description: 'Data de atualização', example: '2024-01-01T00:00:00Z' })
  updated_at: Date;
}

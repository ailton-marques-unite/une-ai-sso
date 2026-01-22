import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiPropertyOptional({ description: 'Token de acesso JWT' })
  access_token?: string;

  @ApiPropertyOptional({ description: 'Token de refresh' })
  refresh_token?: string;

  @ApiPropertyOptional({ description: 'MFA é obrigatório', example: false })
  mfa_required?: boolean;

  @ApiPropertyOptional({ description: 'Setup de MFA é necessário', example: false })
  setup_required?: boolean;

  @ApiPropertyOptional({ description: 'Token temporário para MFA' })
  mfa_token?: string;

  @ApiPropertyOptional({ description: 'Métodos MFA disponíveis', example: ['totp', 'sms', 'email'] })
  available_methods?: string[];

  @ApiPropertyOptional({ description: 'Tempo de expiração do token em segundos', example: 3600 })
  expires_in?: number;

  @ApiPropertyOptional({ description: 'Tipo do token', example: 'Bearer' })
  token_type?: string;

  @ApiPropertyOptional({ description: 'Mensagem informativa' })
  message?: string;
}

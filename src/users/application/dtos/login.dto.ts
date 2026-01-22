import { IsEmail, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'ID do domínio (opcional se fornecido via header x-domain-id ou x-domain-slug)', 
    example: 'domain-uuid',
    required: false
  })
  @IsOptional()
  @IsUUID('4', { message: 'domain_id deve ser um UUID válido' })
  domain_id?: string;

  @ApiProperty({ description: 'Email do usuário', example: 'usuario@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ description: 'Senha do usuário', example: 'Senha123!@#' })
  @IsString()
  password: string;
}

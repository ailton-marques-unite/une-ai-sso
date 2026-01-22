import { IsEmail, IsString, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Email do usuário', example: 'usuario@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ description: 'Senha do usuário (mínimo 12 caracteres)', example: 'Senha123!@#' })
  @IsString()
  @MinLength(12, { message: 'A senha deve ter no mínimo 12 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial',
  })
  password: string;

  @ApiPropertyOptional({ description: 'Nome completo do usuário', example: 'João Silva' })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional({ description: 'Telefone do usuário', example: '+5511999999999' })
  @IsOptional()
  @IsString()
  phone?: string;
}

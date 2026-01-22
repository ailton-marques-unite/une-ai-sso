import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDomainDto {
  @ApiProperty({
    description: 'Nome do domínio/organização',
    example: 'Minha Empresa',
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Slug único do domínio (usado em URLs)',
    example: 'minha-empresa',
    minLength: 3,
    maxLength: 255,
    pattern: '^[a-z0-9-]+$',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Descrição do domínio',
    example: 'Domínio principal da empresa',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

import { PartialType } from '@nestjs/mapped-types';
import { CreateDomainDto } from './create-domain.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDomainDto extends PartialType(CreateDomainDto) {
  @ApiPropertyOptional({
    description: 'Status ativo/inativo do domínio',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

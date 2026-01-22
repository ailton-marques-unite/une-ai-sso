import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MfaType } from '../../domain/entities/user-mfa.entity';

export class MfaVerifyDto {
  @ApiProperty({ description: 'Código MFA (6 dígitos para TOTP ou código de backup)', example: '123456' })
  @IsString()
  code: string;

  @ApiPropertyOptional({
    description: 'Tipo de MFA',
    enum: MfaType,
    default: MfaType.TOTP,
  })
  @IsOptional()
  @IsEnum(MfaType)
  method?: MfaType;
}

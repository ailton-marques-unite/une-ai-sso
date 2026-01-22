import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MfaType } from '../../domain/entities/user-mfa.entity';

export class MfaChallengeDto {
  @ApiProperty({ description: 'Token temporário retornado no login', example: 'mfa_token_abc123' })
  @IsString()
  mfa_token: string;

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

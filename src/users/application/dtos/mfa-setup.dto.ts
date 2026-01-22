import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MfaType } from '../../domain/entities/user-mfa.entity';

export class MfaSetupDto {
  @ApiPropertyOptional({
    description: 'Tipo de MFA',
    enum: MfaType,
    default: MfaType.TOTP,
  })
  @IsOptional()
  @IsEnum(MfaType)
  method?: MfaType;
}

import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email do usuário', example: 'usuario@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}

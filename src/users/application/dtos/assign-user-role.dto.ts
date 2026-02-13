import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AssignUserRoleDto {
  @ApiProperty({
    description: 'Identificador da role de domínio a ser atribuída ao usuário',
    example: 'b9f1b9c4-3e3d-4f2b-9f5b-3f9b3c3f9b3c',
  })
  @IsString()
  @IsUUID()
  domainRoleId: string;
}


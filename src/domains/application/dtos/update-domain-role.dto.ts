import { PartialType } from '@nestjs/swagger';
import { CreateDomainRoleDto } from './create-domain-role.dto';

export class UpdateDomainRoleDto extends PartialType(CreateDomainRoleDto) {}


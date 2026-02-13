import { DomainRole } from '../entities/domain-role.entity';

export interface CreateDomainRoleProps {
  domainId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateDomainRoleProps {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface IDomainRoleRepository {
  findById(domainRoleId: string): Promise<DomainRole | null>;
  findRolesByDomainId(domainId: string): Promise<DomainRole[]>;
  existsByName(domainId: string, name: string): Promise<boolean>;
  createRole(props: CreateDomainRoleProps): Promise<DomainRole>;
  updateRole(
    domainRoleId: string,
    props: UpdateDomainRoleProps,
  ): Promise<DomainRole>;
  deleteRole(domainRoleId: string): Promise<void>;
}


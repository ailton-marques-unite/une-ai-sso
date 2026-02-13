import { UserRole } from '../entities/user-role.entity';
import { DomainRole } from '../../../domains/domain/entities/domain-role.entity';

export interface IUserRoleRepository {
  assignRoleToUser(userId: string, roleId: string): Promise<UserRole>;
  removeRoleFromUser(userId: string, roleId: string): Promise<void>;
  findRolesByUserAndDomain(
    userId: string,
    domainId: string,
  ): Promise<DomainRole[]>;
  findUsersByRole(
    roleId: string,
  ): Promise<{ userId: string; domainId: string }[]>;
}


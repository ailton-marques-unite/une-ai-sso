import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../domain/entities/user-role.entity';
import { DomainRole } from '../../../domains/domain/entities/domain-role.entity';
import { IUserRoleRepository } from '../../domain/repositories/user-role.repository.interface';

@Injectable()
export class UserRoleRepository implements IUserRoleRepository {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(DomainRole)
    private readonly domainRoleRepository: Repository<DomainRole>,
  ) {}

  async assignRoleToUser(userId: string, roleId: string): Promise<UserRole> {
    const existing = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId },
    });

    if (existing) {
      return existing;
    }

    const userRole = this.userRoleRepository.create({
      user_id: userId,
      role_id: roleId,
    });

    return this.userRoleRepository.save(userRole);
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.userRoleRepository.delete({
      user_id: userId,
      role_id: roleId,
    });
  }

  async findRolesByUserAndDomain(
    userId: string,
    domainId: string,
  ): Promise<DomainRole[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    return userRoles
      .map((ur) => ur.role)
      .filter((role): role is DomainRole => !!role && role.domain_id === domainId);
  }

  async findUsersByRole(
    roleId: string,
  ): Promise<{ userId: string; domainId: string }[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { role_id: roleId },
      relations: ['user'],
    });

    return userRoles
      .filter((ur) => !!ur.user)
      .map((ur) => ({
        userId: ur.user.id,
        domainId: ur.user.domain_id,
      }));
  }
}


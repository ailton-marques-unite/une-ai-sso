import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { CreateUserDto } from '../../application/dtos/create-user.dto';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByEmail(domainId: string, email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { domain_id: domainId, email },
    });
  }

  async findById(domainId: string, id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { domain_id: domainId, id },
      relations: ['roles', 'roles.role'],
    });
  }

  async create(domainId: string, userData: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({
      ...userData,
      domain_id: domainId,
    });
    return this.userRepository.save(user);
  }

  async update(
    domainId: string,
    id: string,
    userData: Partial<User>,
  ): Promise<User> {
    await this.userRepository.update({ domain_id: domainId, id }, userData);
    const updated = await this.findById(domainId, id);
    if (!updated) {
      throw new Error('User not found after update');
    }
    return updated;
  }

  async updateLastLogin(domainId: string, userId: string): Promise<void> {
    await this.userRepository.update(
      { domain_id: domainId, id: userId },
      { last_login_at: new Date() },
    );
  }

  async existsByEmail(domainId: string, email: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { domain_id: domainId, email },
    });
    return count > 0;
  }
}

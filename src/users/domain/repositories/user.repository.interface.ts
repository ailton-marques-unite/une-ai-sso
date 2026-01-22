import { User } from '../entities/user.entity';
import { CreateUserDto } from '../../application/dtos/create-user.dto';

export interface IUserRepository {
  findByEmail(domainId: string, email: string): Promise<User | null>;
  findById(domainId: string, id: string): Promise<User | null>;
  create(domainId: string, userData: CreateUserDto): Promise<User>;
  update(domainId: string, id: string, userData: Partial<User>): Promise<User>;
  updateLastLogin(domainId: string, userId: string): Promise<void>;
  existsByEmail(domainId: string, email: string): Promise<boolean>;
}

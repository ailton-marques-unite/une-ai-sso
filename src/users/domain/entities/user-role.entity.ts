import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { DomainRole } from '../../../domains/domain/entities/domain-role.entity';

@Entity('user_roles')
@Index(['user_id', 'role_id'], { unique: true })
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => DomainRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: DomainRole;

  @CreateDateColumn()
  created_at: Date;
}

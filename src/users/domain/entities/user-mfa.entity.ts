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

export enum MfaType {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
}

@Entity('user_mfa')
@Index(['user_id', 'mfa_type', 'is_primary'], { unique: true, where: '"is_primary" = true' })
export class UserMfa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.mfaMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  mfa_type: MfaType;

  @Column({ type: 'varchar', length: 255 })
  secret: string; // Criptografado

  @Column({ type: 'text', array: true, nullable: true })
  backup_codes?: string[]; // Criptografados

  @Column({ type: 'boolean', default: false })
  is_primary: boolean;

  @CreateDateColumn()
  created_at: Date;
}

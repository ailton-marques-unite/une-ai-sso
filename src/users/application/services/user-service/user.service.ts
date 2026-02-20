import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { CreateUserDto } from '../../dtos/create-user.dto';
import { UserResponseDto } from '../../dtos/user-response.dto';
import { PasswordService } from '../../../../shared/services/password.service';
import { User } from '../../../domain/entities/user.entity';
import { AppLogger, APP_LOGGER } from '../../../../shared/utils/logger';

@Injectable()
export class UserService {
  private readonly context = UserService.name;

  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordService,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  async create(
    domainId: string,
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log('create started', this.context, domainId);
    // Validar força da senha
    const passwordValidation = this.passwordService.validatePasswordStrength(
      createUserDto.password,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.errors.join(', '));
    }

    // Verificar se email já existe no domínio
    const emailExists = await this.userRepository.existsByEmail(
      domainId,
      createUserDto.email,
    );
    if (emailExists) {
      throw new ConflictException(
        'This email address is already in use on this domain.',
      );
    }

    // Hash da senha
    const passwordHash = await this.passwordService.hashPassword(
      createUserDto.password,
    );

    // Criar usuário - remover 'password' do DTO e mapear para 'password_hash'
    const { password, ...userDataWithoutPassword } = createUserDto;
    const user = await this.userRepository.create(domainId, {
      ...userDataWithoutPassword,
      password_hash: passwordHash,
    });

    this.logger.log('create completed', this.context, domainId);
    return this.toResponseDto(user);
  }

  async findById(domainId: string, id: string): Promise<UserResponseDto> {
    this.logger.debug('findById started', this.context, domainId);
    const user = await this.userRepository.findById(domainId, id);
    if (!user) {
      this.logger.warn('findById: user not found', this.context, domainId);
      throw new NotFoundException('User not found');
    }
    return this.toResponseDto(user);
  }

  async findByEmail(domainId: string, email: string): Promise<User | null> {
    this.logger.debug('findByEmail started', this.context, domainId);
    return this.userRepository.findByEmail(domainId, email);
  }

  async updateLastLogin(domainId: string, userId: string): Promise<void> {
    this.logger.debug('updateLastLogin started', this.context, domainId);
    await this.userRepository.updateLastLogin(domainId, userId);
  }

  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      is_active: user.is_active,
      is_verified: user.is_verified,
      mfa_enabled: user.mfa_enabled,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}

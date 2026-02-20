import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AppLogger, APP_LOGGER } from '../utils/logger';

@Injectable()
export class PasswordService {
  private readonly context = PasswordService.name;
  private readonly saltRounds: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {
    this.saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_ROUNDS', '10'),
      10,
    );
  }

  async hashPassword(password: string): Promise<string> {
    this.logger.debug('hashPassword started', this.context);
    return bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    this.logger.debug('comparePassword started', this.context);
    return bcrypt.compare(password, hashedPassword);
  }

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('A senha deve ter no mínimo 12 caracteres');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra minúscula');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/\d/.test(password)) {
      errors.push('A senha deve conter pelo menos um número');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push(
        'A senha deve conter pelo menos um caractere especial (@$!%*?&)',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

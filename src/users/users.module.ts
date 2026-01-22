import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './domain/entities/user.entity';
import { UserRole } from './domain/entities/user-role.entity';
import { UserMfa } from './domain/entities/user-mfa.entity';
import { PasswordResetToken } from './domain/entities/password-reset-token.entity';
import { Domain } from '../domains/domain/entities/domain.entity';
import { DomainRole } from '../domains/domain/entities/domain-role.entity';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UserService } from './application/services/user-service/user.service';
import { AuthService } from './application/services/auth-service/auth.service';
import { PasswordRecoveryService } from './application/services/password-recovery-service/password-recovery.service';
import { PasswordService } from '../shared/services/password.service';
import { AppJwtService } from '../shared/services/jwt.service';
import { RefreshTokenService } from '../shared/services/refresh-token.service';
import { JwtStrategy } from '../shared/strategies/jwt.strategy';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { UserController } from './infrastructure/controllers/user.controller';
import { PasswordRecoveryController } from './infrastructure/controllers/password-recovery.controller';
import { RbacService } from './application/services/rbac-service/rbac.service';
import { MfaService } from './application/services/mfa-service/mfa.service';
import { SsoService } from './application/services/sso-service/sso.service';
import { RolesGuard } from '../shared/guards/roles.guard';
import { MfaController } from './infrastructure/controllers/mfa.controller';
import { SsoController } from './infrastructure/controllers/sso.controller';
import { SmsService } from '../shared/services/sms.service';
import { EmailService } from '../shared/services/email.service';
import { RedisModule } from '../shared/infrastructure/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRole,
      UserMfa,
      PasswordResetToken,
      Domain,
      DomainRole,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
  ],
  controllers: [
    AuthController,
    UserController,
    PasswordRecoveryController,
    MfaController,
    SsoController,
  ],
  providers: [
    UserRepository,
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
    UserService,
    AuthService,
    PasswordRecoveryService,
    RbacService,
    MfaService,
    SsoService,
    SmsService,
    EmailService,
    PasswordService,
    AppJwtService,
    RefreshTokenService,
    JwtStrategy,
    RolesGuard,
  ],
  exports: [UserService, AuthService, RbacService, AppJwtService],
})
export class UsersModule {}

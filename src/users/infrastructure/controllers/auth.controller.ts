import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../../application/services/auth-service/auth.service';
import { LoginDto } from '../../application/dtos/login.dto';
import { LoginResponseDto } from '../../application/dtos/login-response.dto';
import { CreateUserDto } from '../../application/dtos/create-user.dto';
import { UserResponseDto } from '../../application/dtos/user-response.dto';
import { RefreshTokenDto } from '../../application/dtos/refresh-token.dto';
import { MfaChallengeDto } from '../../application/dtos/mfa-challenge.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'Email já está em uso' })
  async register(
    @Body() createUserDto: CreateUserDto,
    @Request() req: any,
  ): Promise<UserResponseDto> {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context é obrigatório para registro');
    }
    return this.authService.register(domainId, createUserDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 tentativas por 15 minutos
  @ApiOperation({ summary: 'Login com credenciais' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
  ): Promise<LoginResponseDto> {
    // Usar domain_id do contexto se não fornecido no body
    const domainId = loginDto.domain_id || req.domainContext?.domainId;
    if (!domainId) {
      throw new BadRequestException(
        'Domain context é obrigatório. Forneça domain_id no body ou via header x-domain-id/x-domain-slug',
      );
    }
    return this.authService.login({ ...loginDto, domain_id: domainId });
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tentativas por minuto
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token renovado com sucesso',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: any,
  ): Promise<LoginResponseDto> {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context é obrigatório para refresh token');
    }
    return this.authService.refreshToken(domainId, refreshTokenDto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout - revogar tokens' })
  @ApiResponse({ status: 200, description: 'Logout realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async logout(
    @Body() body: { refresh_token?: string },
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context e usuário são obrigatórios');
    }

    await this.authService.logout(domainId, userId, body.refresh_token);

    return {
      success: true,
      message: 'Logout realizado com sucesso',
    };
  }

  @Post('mfa-challenge')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 tentativas por 10 minutos
  @ApiOperation({ summary: 'Verificar código MFA após login' })
  @ApiBody({ type: MfaChallengeDto })
  @ApiResponse({
    status: 200,
    description: 'MFA verificado com sucesso, tokens JWT retornados',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Código MFA inválido' })
  async verifyMfaChallenge(
    @Body() mfaChallengeDto: MfaChallengeDto,
  ): Promise<LoginResponseDto> {
    return this.authService.verifyMfaChallenge(
      mfaChallengeDto.mfa_token,
      mfaChallengeDto.code,
      mfaChallengeDto.method,
    );
  }
}

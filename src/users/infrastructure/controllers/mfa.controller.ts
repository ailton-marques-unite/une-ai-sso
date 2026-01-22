import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from '../../application/services/mfa-service/mfa.service';
import { MfaSetupDto } from '../../application/dtos/mfa-setup.dto';
import { MfaVerifyDto } from '../../application/dtos/mfa-verify.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { MfaType } from '../../domain/entities/user-mfa.entity';

@ApiTags('MFA')
@Controller('mfa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @ApiOperation({ summary: 'Configurar MFA (TOTP)' })
  @ApiResponse({
    status: 200,
    description: 'MFA configurado com sucesso. Retorna QR code e códigos de backup.',
  })
  async setupMfa(
    @Body() mfaSetupDto: MfaSetupDto,
    @Request() req: any,
  ): Promise<{
    secret: string;
    qr_code: string;
    backup_codes: string[];
  }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context e usuário são obrigatórios');
    }

    return this.mfaService.setupMfa(
      domainId,
      userId,
      mfaSetupDto.method || MfaType.TOTP,
    );
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 tentativas por 10 minutos
  @ApiOperation({ summary: 'Verificar código MFA para habilitar' })
  @ApiResponse({
    status: 200,
    description: 'MFA habilitado com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Código inválido' })
  async verifyMfa(
    @Body() mfaVerifyDto: MfaVerifyDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context e usuário são obrigatórios');
    }

    await this.mfaService.enableMfa(
      domainId,
      userId,
      mfaVerifyDto.code,
      mfaVerifyDto.method || MfaType.TOTP,
    );

    return {
      success: true,
      message: 'MFA habilitado com sucesso',
    };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 86400000 } }) // 2 tentativas por dia
  @ApiOperation({ summary: 'Desabilitar MFA' })
  @ApiResponse({
    status: 200,
    description: 'MFA desabilitado com sucesso',
  })
  async disableMfa(@Request() req: any): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context e usuário são obrigatórios');
    }

    await this.mfaService.disableMfa(domainId, userId);

    return {
      success: true,
      message: 'MFA desabilitado com sucesso',
    };
  }

  @Get('backup-codes')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  @ApiOperation({ summary: 'Gerar novos códigos de backup' })
  @ApiResponse({
    status: 200,
    description: 'Novos códigos de backup gerados',
  })
  async generateBackupCodes(
    @Request() req: any,
  ): Promise<{ backup_codes: string[] }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context e usuário são obrigatórios');
    }

    const backupCodes = await this.mfaService.generateBackupCodes(
      domainId,
      userId,
    );

    return { backup_codes: backupCodes };
  }

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @ApiOperation({ summary: 'Enviar código MFA via SMS ou Email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: [MfaType.SMS, MfaType.EMAIL],
          description: 'Método MFA (sms ou email)',
        },
      },
      required: ['method'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Código enviado com sucesso',
  })
  async sendMfaCode(
    @Body() body: { method: MfaType },
    @Request() req: any,
  ): Promise<{ success: boolean; message: string; expiresIn: number }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context e usuário são obrigatórios');
    }

    const { code, expiresIn } = await this.mfaService.sendMfaCode(
      domainId,
      userId,
      body.method,
    );

    return {
      success: true,
      message: `Código enviado via ${body.method}`,
      expiresIn,
    };
  }
}

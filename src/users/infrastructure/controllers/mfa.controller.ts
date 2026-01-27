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
  @ApiOperation({ summary: 'Configure MFA (TOTP)' })
  @ApiResponse({
    status: 200,
    description: 'MFA configured successfully. Returns QR code and backup codes.',
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
      throw new Error('Domain context and user are required');
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
  @ApiOperation({ summary: 'Verify MFA code to enable' })
  @ApiResponse({
    status: 200,
    description: 'MFA enabled successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid code' })
  async verifyMfa(
    @Body() mfaVerifyDto: MfaVerifyDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context and user are required');
    }

    await this.mfaService.enableMfa(
      domainId,
      userId,
      mfaVerifyDto.code,
      mfaVerifyDto.method || MfaType.TOTP,
    );

    return {
      success: true,
      message: 'MFA enabled successfully',
    };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 86400000 } }) // 2 tentativas por dia
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({
    status: 200,
    description: 'MFA disabled successfully',
  })
  async disableMfa(@Request() req: any): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context and user are required');
    }

    await this.mfaService.disableMfa(domainId, userId);

    return {
      success: true,
      message: 'MFA disabled successfully',
    };
  }

  @Get('backup-codes')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  @ApiOperation({ summary: 'Generate new backup codes' })
  @ApiResponse({
    status: 200,
    description: 'New backup codes generated',
  })
  async generateBackupCodes(
    @Request() req: any,
  ): Promise<{ backup_codes: string[] }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context and user are required');
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
  @ApiOperation({ summary: 'Send MFA code via SMS or Email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: [MfaType.SMS, MfaType.EMAIL],
          description: 'MFA method (sms or email)',
        },
      },
      required: ['method'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Code sent successfully',
  })
  async sendMfaCode(
    @Body() body: { method: MfaType },
    @Request() req: any,
  ): Promise<{ success: boolean; message: string; expiresIn: number }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context and user are required');
    }

    const { code, expiresIn } = await this.mfaService.sendMfaCode(
      domainId,
      userId,
      body.method,
    );

    return {
      success: true,
      message: `Code sent via ${body.method}`,
      expiresIn,
    };
  }
}

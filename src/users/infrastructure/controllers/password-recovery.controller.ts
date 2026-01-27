import { Controller, Post, Body, HttpCode, HttpStatus, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PasswordRecoveryService } from '../../application/services/password-recovery-service/password-recovery.service';
import { ForgotPasswordDto } from '../../application/dtos/forgot-password.dto';
import { ResetPasswordDto } from '../../application/dtos/reset-password.dto';
import { Public } from '../../../shared/decorators/public.decorator';

@ApiTags('Password Recovery')
@Controller('auth/password')
export class PasswordRecoveryController {
  constructor(
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Post('forgot')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (if email exists)',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context is required');
    }
    return this.passwordRecoveryService.requestPasswordReset(
      domainId,
      forgotPasswordDto,
    );
  }

  @Post('reset')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context is required');
    }
    return this.passwordRecoveryService.resetPassword(domainId, resetPasswordDto);
  }
}

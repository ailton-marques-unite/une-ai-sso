import {
  Controller,
  Get,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import { SsoService } from '../../application/services/sso-service/sso.service';

@ApiTags('SSO')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start OAuth2 flow with Google' })
  @ApiQuery({
    name: 'domain_id',
    required: false,
    description: 'Domain ID (optional, will be discovered via email if not provided)',
  })
  @ApiResponse({
    status: 200,
    description: 'Google authorization URL',
  })
  async initiateGoogleOAuth(
    @Query('domain_id') domainId?: string,
  ): Promise<{ authUrl: string; state: string }> {
    return this.ssoService.initiateGoogleOAuth(domainId);
  }

  @Get('google/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback after Google authentication' })
  @ApiQuery({ name: 'code', description: 'Google authorization code' })
  @ApiQuery({ name: 'state', description: 'State token for validation' })
  @ApiResponse({
    status: 200,
    description: 'Generated JWT tokens',
  })
  @ApiResponse({ status: 400, description: 'Invalid code or state' })
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.ssoService.handleGoogleCallback(code, state);

    // Redirecionar para frontend com tokens (ou retornar JSON)
    // Por enquanto, retornar JSON. Frontend pode fazer redirect depois
    res.json({
      success: true,
      ...tokens,
      message: 'Google authentication successful',
    });
  }

  @Get('microsoft')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start OAuth2 flow with Microsoft' })
  @ApiQuery({
    name: 'domain_id',
    required: false,
    description: 'Domain ID (optional, will be discovered via Tenant ID if not provided)',
  })
  @ApiResponse({
    status: 200,
    description: 'Microsoft authorization URL',
  })
  async initiateMicrosoftOAuth(
    @Query('domain_id') domainId?: string,
  ): Promise<{ authUrl: string; state: string }> {
    return this.ssoService.initiateMicrosoftOAuth(domainId);
  }

  @Get('microsoft/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback after Microsoft authentication' })
  @ApiQuery({ name: 'code', description: 'Microsoft authorization code' })
  @ApiQuery({ name: 'state', description: 'State token for validation' })
  @ApiResponse({
    status: 200,
    description: 'Generated JWT tokens',
  })
  @ApiResponse({ status: 400, description: 'Invalid code or state' })
  async handleMicrosoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.ssoService.handleMicrosoftCallback(code, state);

    // Redirecionar para frontend com tokens (ou retornar JSON)
    // Por enquanto, retornar JSON. Frontend pode fazer redirect depois
    res.json({
      success: true,
      ...tokens,
      message: 'Microsoft authentication successful',
    });
  }
}

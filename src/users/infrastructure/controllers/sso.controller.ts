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
  @ApiOperation({ summary: 'Iniciar fluxo OAuth2 com Google' })
  @ApiQuery({
    name: 'domain_id',
    required: false,
    description: 'ID do domínio (opcional, será descoberto via email se não fornecido)',
  })
  @ApiResponse({
    status: 200,
    description: 'URL de autorização Google',
  })
  async initiateGoogleOAuth(
    @Query('domain_id') domainId?: string,
  ): Promise<{ authUrl: string; state: string }> {
    return this.ssoService.initiateGoogleOAuth(domainId);
  }

  @Get('google/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback após autenticação Google' })
  @ApiQuery({ name: 'code', description: 'Authorization code do Google' })
  @ApiQuery({ name: 'state', description: 'State token para validação' })
  @ApiResponse({
    status: 200,
    description: 'Tokens JWT gerados',
  })
  @ApiResponse({ status: 400, description: 'Código ou state inválido' })
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
      message: 'Autenticação Google realizada com sucesso',
    });
  }

  @Get('microsoft')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar fluxo OAuth2 com Microsoft' })
  @ApiQuery({
    name: 'domain_id',
    required: false,
    description: 'ID do domínio (opcional, será descoberto via Tenant ID se não fornecido)',
  })
  @ApiResponse({
    status: 200,
    description: 'URL de autorização Microsoft',
  })
  async initiateMicrosoftOAuth(
    @Query('domain_id') domainId?: string,
  ): Promise<{ authUrl: string; state: string }> {
    return this.ssoService.initiateMicrosoftOAuth(domainId);
  }

  @Get('microsoft/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback após autenticação Microsoft' })
  @ApiQuery({ name: 'code', description: 'Authorization code do Microsoft' })
  @ApiQuery({ name: 'state', description: 'State token para validação' })
  @ApiResponse({
    status: 200,
    description: 'Tokens JWT gerados',
  })
  @ApiResponse({ status: 400, description: 'Código ou state inválido' })
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
      message: 'Autenticação Microsoft realizada com sucesso',
    });
  }
}

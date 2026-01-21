import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class ThrottlerDomainGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Usar domain_id do context se disponível, caso contrário usar IP
    const domainId = (req as any).domainContext?.domainId || 'global';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const endpoint = req.route?.path || req.path;

    // Chave Redis: rl:domainId:endpoint:ip
    return `rl:${domainId}:${endpoint}:${ip}`;
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return `${name}:${suffix}`;
  }
}

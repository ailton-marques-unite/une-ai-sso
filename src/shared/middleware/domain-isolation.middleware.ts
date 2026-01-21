import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class DomainIsolationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!req.domainContext) {
      throw new ForbiddenException('Domain context not found');
    }

    // Validar que o JWT (se existir) pertence ao mesmo domínio
    const tokenDomainId = (req as any).user?.domain_id;
    if (tokenDomainId && tokenDomainId !== req.domainContext.domainId) {
      throw new ForbiddenException(
        'Token domain does not match request domain',
      );
    }

    next();
  }
}

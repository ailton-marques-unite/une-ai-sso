import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Domain } from '../../domains/domain/entities/domain.entity';
import { DomainContext } from '../types/domain-context.types';

declare global {
  namespace Express {
    interface Request {
      domainContext?: DomainContext;
    }
  }
}

@Injectable()
export class DomainContextMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extrair domain_id ou domain_slug do header, query ou body
    const domainId =
      (req.headers['x-domain-id'] as string) ||
      (req.query.domain_id as string) ||
      (req.body?.domain_id as string);

    const domainSlug =
      (req.headers['x-domain-slug'] as string) ||
      (req.query.domain_slug as string);

    let domain: Domain | null = null;

    if (domainId) {
      domain = await this.domainRepository.findOne({
        where: { id: domainId, is_active: true },
      });
    } else if (domainSlug) {
      domain = await this.domainRepository.findOne({
        where: { slug: domainSlug, is_active: true },
      });
    }

    if (!domain) {
      throw new BadRequestException(
        'Domain context is required. Provide x-domain-id or x-domain-slug header, domain_id/domain_slug query param, or domain_id in body',
      );
    }

    // Injetar domain context na requisição
    req.domainContext = {
      domainId: domain.id,
      domainSlug: domain.slug,
      domain,
    };

    next();
  }
}

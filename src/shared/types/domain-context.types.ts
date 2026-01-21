import { Request } from 'express';
import { Domain } from '../../domains/domain/entities/domain.entity';

export interface DomainContext {
  domainId: string;
  domainSlug: string;
  domain: Domain;
}

export interface RequestWithDomain extends Request {
  domainContext?: DomainContext;
}

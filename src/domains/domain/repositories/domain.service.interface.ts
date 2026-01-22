import { CreateDomainDto } from '../../application/dtos/create-domain.dto';
import { UpdateDomainDto } from '../../application/dtos/update-domain.dto';
import { ListDomainsQueryDto } from '../../application/dtos/list-domains-query.dto';
import { Domain } from '../entities/domain.entity';

export interface IDomainService {
  create(createDomainDto: CreateDomainDto, createdBy: string): Promise<Domain>;
  findAll(query: ListDomainsQueryDto): Promise<{ data: Domain[]; total: number; page: number; limit: number }>;
  findOne(id: string): Promise<Domain | null>;
  findBySlug(slug: string): Promise<Domain | null>;
  update(id: string, updateDomainDto: UpdateDomainDto): Promise<Domain | null>;
  remove(id: string): Promise<boolean>;
  activate(id: string): Promise<boolean>;
}

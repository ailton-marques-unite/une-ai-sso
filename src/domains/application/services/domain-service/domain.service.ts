import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Domain } from '../../../domain/entities/domain.entity';
import { CreateDomainDto } from '../../dtos/create-domain.dto';
import { UpdateDomainDto } from '../../dtos/update-domain.dto';
import { ListDomainsQueryDto } from '../../dtos/list-domains-query.dto';
import { IDomainService } from '../../../domain/repositories/domain.service.interface';

@Injectable()
export class DomainService implements IDomainService {
  constructor(
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
  ) {}

  async create(createDomainDto: CreateDomainDto, createdBy: string): Promise<Domain> {
    // Verificar se o slug já existe
    const existingDomain = await this.domainRepository.findOne({
      where: { slug: createDomainDto.slug },
    });

    if (existingDomain) {
      throw new ConflictException(`Domain with slug "${createDomainDto.slug}" already exists`);
    }

    const domain = this.domainRepository.create({
      ...createDomainDto,
      created_by: createdBy,
    });

    return this.domainRepository.save(domain);
  }

  async findAll(query: ListDomainsQueryDto): Promise<{
    data: Domain[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, is_active, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    if (search) {
      where.name = Like(`%${search}%`);
    }

    const [data, total] = await this.domainRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Domain | null> {
    return this.domainRepository.findOne({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Domain | null> {
    return this.domainRepository.findOne({
      where: { slug },
    });
  }

  async update(id: string, updateDomainDto: UpdateDomainDto): Promise<Domain | null> {
    const domain = await this.findOne(id);

    if (!domain) {
      throw new NotFoundException(`Domain with ID "${id}" not found`);
    }

    // Se está atualizando o slug, verificar se não existe outro domínio com o mesmo slug
    if (updateDomainDto.slug && updateDomainDto.slug !== domain.slug) {
      const existingDomain = await this.findBySlug(updateDomainDto.slug);
      if (existingDomain) {
        throw new ConflictException(`Domain with slug "${updateDomainDto.slug}" already exists`);
      }
    }

    Object.assign(domain, updateDomainDto);
    return this.domainRepository.save(domain);
  }

  async remove(id: string): Promise<boolean> {
    const domain = await this.findOne(id);

    if (!domain) {
      throw new NotFoundException(`Domain with ID "${id}" not found`);
    }

    domain.is_active = false;
    await this.domainRepository.save(domain);
    return true;
  }

  async activate(id: string): Promise<boolean> {
    const domain = await this.findOne(id);

    if (!domain) {
      throw new NotFoundException(`Domain with ID "${id}" not found`);
    }

    domain.is_active = true;
    await this.domainRepository.save(domain);
    return true;
  }
}

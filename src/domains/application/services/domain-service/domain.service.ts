import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Domain } from '../../../domain/entities/domain.entity';
import { CreateDomainDto } from '../../dtos/create-domain.dto';
import { UpdateDomainDto } from '../../dtos/update-domain.dto';
import { ListDomainsQueryDto } from '../../dtos/list-domains-query.dto';
import { IDomainService } from '../../../domain/repositories/domain.service.interface';
import { AppLogger, APP_LOGGER } from '../../../../shared/utils/logger';

@Injectable()
export class DomainService implements IDomainService {
  private readonly context = DomainService.name;

  constructor(
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
    @Inject(APP_LOGGER)
    private readonly logger: AppLogger,
  ) {}

  async create(createDomainDto: CreateDomainDto, createdBy: string): Promise<Domain> {
    this.logger.log('create started', this.context);
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

    const saved = await this.domainRepository.save(domain);
    this.logger.log('create completed', this.context);
    return saved;
  }

  async findAll(query: ListDomainsQueryDto): Promise<{
    data: Domain[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.debug('findAll started', this.context);
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
    this.logger.debug('findOne started', this.context, id);
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
    this.logger.log('update started', this.context, id);
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
    const saved = await this.domainRepository.save(domain);
    this.logger.log('update completed', this.context, id);
    return saved;
  }

  async remove(id: string): Promise<boolean> {
    this.logger.log('remove started', this.context, id);
    const domain = await this.findOne(id);

    if (!domain) {
      throw new NotFoundException(`Domain with ID "${id}" not found`);
    }

    domain.is_active = false;
    await this.domainRepository.save(domain);
    this.logger.log('remove completed', this.context, id);
    return true;
  }

  async activate(id: string): Promise<boolean> {
    this.logger.log('activate started', this.context, id);
    const domain = await this.findOne(id);

    if (!domain) {
      throw new NotFoundException(`Domain with ID "${id}" not found`);
    }

    domain.is_active = true;
    await this.domainRepository.save(domain);
    this.logger.log('activate completed', this.context, id);
    return true;
  }
}

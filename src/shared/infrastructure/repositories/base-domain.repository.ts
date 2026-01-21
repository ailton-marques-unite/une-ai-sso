import { Repository, FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';

/**
 * Base repository com domain-scoping automático
 * Garante que todas as queries sejam filtradas por domain_id
 */
export abstract class BaseDomainRepository<T extends { domain_id: string }> extends Repository<T> {
  /**
   * Encontra todas as entidades de um domínio específico
   */
  async findByDomain(
    domainId: string,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    const where = options?.where as FindOptionsWhere<T> | undefined;
    return this.find({
      ...options,
      where: {
        domain_id: domainId,
        ...where,
      } as FindOptionsWhere<T>,
    });
  }

  /**
   * Encontra uma entidade de um domínio específico
   */
  async findOneByDomain(
    domainId: string,
    options?: FindManyOptions<T>,
  ): Promise<T | null> {
    const result = await this.find({
      ...options,
      take: 1,
      where: {
        domain_id: domainId,
        ...(options?.where as FindOptionsWhere<T>),
      } as FindOptionsWhere<T>,
    });

    return result[0] || null;
  }

  /**
   * Cria uma entidade associada a um domínio
   */
  async createForDomain(domainId: string, entityData: DeepPartial<T>): Promise<T> {
    const entity = this.create({
      ...entityData,
      domain_id: domainId,
    } as DeepPartial<T>);

    return this.save(entity);
  }

  /**
   * Atualiza uma entidade garantindo que pertence ao domínio
   */
  async updateForDomain(
    domainId: string,
    id: string,
    updateData: DeepPartial<T>,
  ): Promise<T | null> {
    const entity = await this.findOne({
      where: {
        id,
        domain_id: domainId,
      } as unknown as FindOptionsWhere<T>,
    });

    if (!entity) {
      return null;
    }

    Object.assign(entity, updateData);
    return this.save(entity);
  }

  /**
   * Remove uma entidade garantindo que pertence ao domínio
   */
  async deleteForDomain(domainId: string, id: string): Promise<boolean> {
    const result = await this.delete({
      id,
      domain_id: domainId,
    } as unknown as FindOptionsWhere<T>);

    return (result.affected || 0) > 0;
  }

  /**
   * Conta entidades de um domínio específico
   */
  async countByDomain(domainId: string, options?: FindManyOptions<T>): Promise<number> {
    return this.count({
      ...options,
      where: {
        domain_id: domainId,
        ...(options?.where as FindOptionsWhere<T>),
      } as FindOptionsWhere<T>,
    });
  }
}

import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddMsTenantIdToDomains1704067208000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna ms_tenant_id
    await queryRunner.addColumn(
      'domains',
      new TableColumn({
        name: 'ms_tenant_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    // Criar índice para busca rápida
    await queryRunner.createIndex(
      'domains',
      new TableIndex({
        name: 'idx_domains_ms_tenant_id',
        columnNames: ['ms_tenant_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover índice
    await queryRunner.dropIndex('domains', 'idx_domains_ms_tenant_id');

    // Remover coluna
    await queryRunner.dropColumn('domains', 'ms_tenant_id');
  }
}

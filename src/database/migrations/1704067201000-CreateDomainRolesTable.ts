import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateDomainRolesTable1704067201000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'domain_roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'domain_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'permissions',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'domain_roles',
      new TableForeignKey({
        columnNames: ['domain_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'domains',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createUniqueConstraint(
      'domain_roles',
      new TableUnique({
        name: 'UQ_domain_roles_domain_id_name',
        columnNames: ['domain_id', 'name'],
      }),
    );

    await queryRunner.createIndex(
      'domain_roles',
      new TableIndex({
        name: 'idx_domain_roles_domain_id',
        columnNames: ['domain_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('domain_roles');
    const foreignKey = table?.foreignKeys.find(
      fk => fk.columnNames.indexOf('domain_id') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('domain_roles', foreignKey);
    }
    await queryRunner.dropTable('domain_roles');
  }
}

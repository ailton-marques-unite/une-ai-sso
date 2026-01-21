import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserMfaTable1704067206000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_mfa',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'mfa_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'secret',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'backup_codes',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'is_primary',
            type: 'boolean',
            default: false,
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
      'user_mfa',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'user_mfa',
      new TableIndex({
        name: 'idx_user_mfa_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_mfa');
    const foreignKey = table?.foreignKeys.find(
      fk => fk.columnNames.indexOf('user_id') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('user_mfa', foreignKey);
    }
    await queryRunner.dropTable('user_mfa');
  }
}

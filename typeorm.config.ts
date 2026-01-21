import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres_uneaisso',
  password: process.env.DATABASE_PASSWORD || 'postgres_UneA1Ss0',
  database: process.env.DATABASE_NAME || 'une_ai_sso',
  // autoLoadEntities: true já carrega automaticamente as entidades registradas em TypeOrmModule.forFeature()
  // Não precisamos especificar entities manualmente quando usamos autoLoadEntities
  migrations: [join(__dirname, 'src', 'database', 'migrations', '*.{ts,js}')],
  synchronize: process.env.NODE_ENV === 'development' && process.env.DATABASE_SYNC === 'true',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  migrationsRun: false,
  autoLoadEntities: true,
};

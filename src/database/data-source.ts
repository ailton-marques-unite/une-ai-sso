import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres_uneaisso',
  password: process.env.DATABASE_PASSWORD || 'postgres_UneA1Ss0',
  database: process.env.DATABASE_NAME || 'une_ai_sso',
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default AppDataSource;

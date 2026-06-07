import knex from 'knex';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

// В продакшене миграции в dist/, в dev — в src/
const migrationsDir = isProd
  ? path.join(__dirname, 'migrations')
  : path.join(__dirname, 'migrations');

const seedsDir = isProd
  ? path.join(__dirname, '../database/seeds')
  : path.join(__dirname, 'seeds');

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: isProd ? { rejectUnauthorized: false } : false,
  },
  migrations: {
    directory: migrationsDir,
    extension: 'js',
  },
  seeds: {
    directory: seedsDir,
    extension: 'js',
  },
});

export default db;

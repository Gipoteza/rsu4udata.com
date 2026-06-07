import knex from 'knex';
import path from 'path';

// __dirname в скомпилированном JS = /app/backend/dist/database
// Миграции находятся в /app/backend/dist/database/migrations
const migrationsDir = path.join(__dirname, 'migrations');
const seedsDir = path.join(__dirname, 'seeds');

console.log('[DB] __dirname:', __dirname);
console.log('[DB] migrationsDir:', migrationsDir);
console.log('[DB] seedsDir:', seedsDir);
console.log('[DB] DATABASE_URL exists:', !!process.env.DATABASE_URL);

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  migrations: {
    directory: migrationsDir,
  },
  seeds: {
    directory: seedsDir,
  },
});

export default db;

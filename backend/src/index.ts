import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import authController from './controllers/authController';
import kommoController from './controllers/kommoController';
import db from './database/db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (_origin, callback) => callback(null, true),
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authController);
app.use('/api/integrations/kommo', kommoController);

// Создаёт таблицы и admin пользователя
app.get('/api/setup', async (_req, res) => {
  try {
    console.log('[SETUP] Starting setup...');

    if (!await db.schema.hasTable('users')) {
      await db.schema.createTable('users', (t) => {
        t.increments('id').primary();
        t.string('email', 255).notNullable().unique();
        t.string('password_hash', 255).notNullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] users table created');
    }

    if (!await db.schema.hasTable('session_tokens')) {
      await db.schema.createTable('session_tokens', (t) => {
        t.string('jti', 128).primary();
        t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        t.timestamp('expires_at').notNullable();
        t.timestamp('revoked_at').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] session_tokens table created');
    }

    if (!await db.schema.hasTable('branches')) {
      await db.schema.createTable('branches', (t) => {
        t.integer('id').primary();
        t.string('name', 100).notNullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
      });
      await db('branches').insert([
        { id: 1, name: 'Branch 1' },
        { id: 2, name: 'Branch 2' },
        { id: 3, name: 'Branch 3' },
        { id: 4, name: 'Branch 4' },
      ]);
      console.log('[SETUP] branches table created');
    }

    if (!await db.schema.hasTable('kommo_accounts')) {
      await db.schema.createTable('kommo_accounts', (t) => {
        t.increments('id').primary();
        t.integer('branch_id').notNullable().unique().references('id').inTable('branches').onDelete('CASCADE');
        t.string('base_domain', 255).notNullable();
        t.text('access_token_enc').notNullable();
        t.text('refresh_token_enc').notNullable();
        t.timestamp('expires_at').notNullable();
        t.string('status', 32).notNullable().defaultTo('not_connected');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] kommo_accounts table created');
    }

    const email = 'basegipoteza@gmail.com';
    const existing = await db('users').where({ email }).first();
    if (existing) {
      console.log('[SETUP] User already exists');
      return res.json({ ok: true, message: 'Setup complete (user exists)', email });
    }

    const hash = await bcrypt.hash('Lets#-bro-Pass#323255', 12);
    await db('users').insert({ email, password_hash: hash });
    console.log('[SETUP] Admin user created');

    return res.json({ ok: true, message: 'Setup complete! Admin created.', email });
  } catch (err: any) {
    console.error('[SETUP] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    const hasUsers = await db.schema.hasTable('users');
    const users = hasUsers ? await db('users').select('id', 'email') : [];
    res.json({ status: 'ok', db: 'connected', users, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/', (_req, res) => {
  res.json({
    service: 'RSU4U Backend',
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
  });
});

app.listen(PORT, () => {
  console.log(`[STARTUP] Backend on port ${PORT}`);
  console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[STARTUP] DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`[STARTUP] JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
});

export default app;

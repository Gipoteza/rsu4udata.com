import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import authController from './controllers/authController';
import kommoController from './controllers/kommoController';
import facebookController from './controllers/facebookController';
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
app.use('/api/integrations/facebook', facebookController);

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
        { id: 1, name: 'Киев' },
        { id: 2, name: 'Одесса' },
        { id: 3, name: 'Львов' },
        { id: 4, name: 'Варшава' },
      ]);
      console.log('[SETUP] branches table created');
    } else {
      // Обновляем названия филиалов на города
      await db('branches').where({ id: 1 }).update({ name: 'Киев' });
      await db('branches').where({ id: 2 }).update({ name: 'Одесса' });
      await db('branches').where({ id: 3 }).update({ name: 'Львов' });
      await db('branches').where({ id: 4 }).update({ name: 'Варшава' });
      console.log('[SETUP] branch names updated to cities');
    }

    if (!await db.schema.hasTable('kommo_accounts')) {
      await db.schema.createTable('kommo_accounts', (t) => {
        t.increments('id').primary();
        t.integer('branch_id').notNullable().unique().references('id').inTable('branches').onDelete('CASCADE');
        t.string('client_id', 255).nullable();
        t.text('client_secret_enc').nullable();
        t.string('base_domain', 255).nullable();
        t.text('access_token_enc').nullable();
        t.text('refresh_token_enc').nullable();
        t.timestamp('expires_at').nullable();
        t.string('status', 32).notNullable().defaultTo('not_connected');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] kommo_accounts table created');
    } else {
      // Добавляем недостающие колонки если таблица старая
      const cols = ['client_id', 'client_secret_enc'];
      for (const col of cols) {
        const has = await db.schema.hasColumn('kommo_accounts', col);
        if (!has) {
          await db.schema.alterTable('kommo_accounts', (t) => {
            if (col === 'client_id') t.string('client_id', 255).nullable();
            if (col === 'client_secret_enc') t.text('client_secret_enc').nullable();
          });
          console.log(`[SETUP] added column ${col}`);
        }
      }
    }

    if (!await db.schema.hasTable('facebook_accounts')) {
      await db.schema.createTable('facebook_accounts', (t) => {
        t.integer('id').primary();
        t.string('ad_account_id', 64).notNullable();
        t.string('account_name', 255).nullable();
        t.text('access_token_enc').notNullable();
        t.string('status', 32).notNullable().defaultTo('not_connected');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] facebook_accounts table created');
    }

    if (!await db.schema.hasTable('fb_campaign_map')) {
      await db.schema.createTable('fb_campaign_map', (t) => {
        t.integer('branch_id').primary().references('id').inTable('branches').onDelete('CASCADE');
        t.text('campaign_names').notNullable().defaultTo('[]');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] fb_campaign_map table created');
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

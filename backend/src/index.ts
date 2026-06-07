import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authController from './controllers/authController';
import db from './database/db';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://rsu4udata.com',
  'https://www.rsu4udata.com',
];

console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    console.log(`[CORS] Request from origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] BLOCKED origin: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Логирование всех запросов
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} | Origin: ${req.headers.origin} | Cookie: ${req.headers.cookie ? 'present' : 'none'}`);
  next();
});

// Временный endpoint для создания первого admin пользователя
// Удалить после первого использования
app.post('/api/setup', async (req, res) => {
  try {
    const { email, password, secret } = req.body;
    if (secret !== 'rsu4u-setup-2026') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Создаём таблицы если не существуют
    const hasUsers = await db.schema.hasTable('users');
    if (!hasUsers) {
      await db.schema.createTable('users', (t) => {
        t.increments('id').primary();
        t.string('email', 255).notNullable().unique();
        t.string('password_hash', 255).notNullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] Created users table');
    }

    const hasSessionTokens = await db.schema.hasTable('session_tokens');
    if (!hasSessionTokens) {
      await db.schema.createTable('session_tokens', (t) => {
        t.string('jti', 128).primary();
        t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        t.timestamp('expires_at').notNullable();
        t.timestamp('revoked_at').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] Created session_tokens table');
    }

    const hasBranches = await db.schema.hasTable('branches');
    if (!hasBranches) {
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
      console.log('[SETUP] Created branches table');
    }

    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.json({ message: 'User already exists', email });
    }

    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password, 12);
    await db('users').insert({ email, password_hash: hash });

    return res.json({ message: 'Admin created successfully', email });
  } catch (err: any) {
    console.error('[SETUP] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    const userCount = await db('users').count('id as count').first();
    const users = await db('users').select('id', 'email', 'created_at');
    console.log('[HEALTH] Users in DB:', users);
    res.json({
      status: 'ok',
      db: 'connected',
      userCount: userCount?.count,
      users: users.map(u => ({ id: u.id, email: u.email })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[HEALTH] DB error:', err);
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

async function start() {
  try {
    console.log('[STARTUP] Running migrations...');
    await db.migrate.latest();
    console.log('[STARTUP] Migrations completed');

    console.log('[STARTUP] Running seeds...');
    await db.seed.run();
    console.log('[STARTUP] Seeds completed');

    // Проверяем пользователей после seed
    const users = await db('users').select('id', 'email');
    console.log('[STARTUP] Users after seed:', users);
  } catch (err) {
    console.error('[STARTUP] Migration/seed error:', err);
  }

  app.listen(PORT, () => {
    console.log(`[STARTUP] Backend running on port ${PORT}`);
    console.log(`[STARTUP] FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    console.log(`[STARTUP] ADMIN_EMAIL: ${process.env.ADMIN_EMAIL}`);
    console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`);
  });
}

start();

export default app;

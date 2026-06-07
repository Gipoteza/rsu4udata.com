import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import authController from './controllers/authController';
import db from './database/db';

const app = express();
const PORT = process.env.PORT || 3001;

console.log('[STARTUP] PORT:', PORT);
console.log('[STARTUP] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[STARTUP] JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('[STARTUP] NODE_ENV:', process.env.NODE_ENV);

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://rsu4udata.com',
      'https://www.rsu4udata.com',
      'https://rsu4udatacomfrontend-production.up.railway.app',
      'http://localhost:5173',
    ];
    console.log(`[CORS] origin: ${origin}`);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] BLOCKED: ${origin}`);
      callback(null, true); // временно разрешаем всё для отладки
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

// Debug root endpoint
app.get('/', (_req, res) => {
  const info = {
    service: 'RSU4U Backend',
    status: 'running',
    port: PORT,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? 'SET ✓' : 'NOT SET ✗',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ✗',
      FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
    },
    endpoints: ['/api/health', '/api/setup', '/api/auth/login', '/api/auth/logout', '/api/auth/me'],
    timestamp: new Date().toISOString(),
  };
  console.log('[ROOT]', JSON.stringify(info));
  res.json(info);
});

// Routes
app.use('/api/auth', authController);

// Setup endpoint — создаёт таблицы и admin
app.get('/api/setup', async (_req, res) => {
  try {
    console.log('[SETUP] Starting...');

    // users
    if (!await db.schema.hasTable('users')) {
      await db.schema.createTable('users', (t) => {
        t.increments('id').primary();
        t.string('email', 255).notNullable().unique();
        t.string('password_hash', 255).notNullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] Created users table');
    }

    // session_tokens
    if (!await db.schema.hasTable('session_tokens')) {
      await db.schema.createTable('session_tokens', (t) => {
        t.string('jti', 128).primary();
        t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        t.timestamp('expires_at').notNullable();
        t.timestamp('revoked_at').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
      });
      console.log('[SETUP] Created session_tokens table');
    }

    // branches
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
      console.log('[SETUP] Created branches table');
    }

    // admin user
    const email = 'basegipoteza@gmail.com';
    const existing = await db('users').where({ email }).first();
    if (existing) {
      console.log('[SETUP] User already exists');
      return res.json({ ok: true, message: 'User already exists', email });
    }

    const hash = await bcrypt.hash('Lets#-bro-Pass#323255', 12);
    await db('users').insert({ email, password_hash: hash });
    console.log('[SETUP] Admin created');

    return res.json({ ok: true, message: 'Admin created! You can now login.', email });
  } catch (err: any) {
    console.error('[SETUP] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    const hasUsers = await db.schema.hasTable('users');
    const users = hasUsers ? await db('users').select('id', 'email') : [];
    res.json({
      status: 'ok',
      db: 'connected',
      hasUsersTable: hasUsers,
      users,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[STARTUP] Backend running on port ${PORT}`);
});

export default app;

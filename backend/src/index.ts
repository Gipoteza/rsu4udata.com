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

// Routes
app.use('/api/auth', authController);

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

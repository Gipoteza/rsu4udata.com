import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authController from './controllers/authController';
import kommoController from './controllers/kommoController';
import facebookController from './controllers/facebookController';
import db from './database/db';
import { ensureSchema } from './database/ensureSchema';

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

// Ручной триггер пересоздания схемы (на всякий случай)
app.get('/api/setup', async (_req, res) => {
  try {
    await ensureSchema();
    return res.json({ ok: true, message: 'Schema ensured' });
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
  });
});

async function start() {
  try {
    await ensureSchema();
    console.log('[STARTUP] Schema ensured');
  } catch (err: any) {
    console.error('[STARTUP] Schema error:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[STARTUP] Backend on port ${PORT}`);
    console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[STARTUP] DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  });
}

start();

export default app;

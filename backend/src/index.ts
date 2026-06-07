import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authController from './controllers/authController';
import db from './database/db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://rsu4udata.com',
    'https://www.rsu4udata.com',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authController);

app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    const userCount = await db('users').count('id as count').first();
    res.json({ status: 'ok', db: 'connected', users: userCount?.count, timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Запуск миграций при старте
async function start() {
  try {
    await db.migrate.latest();
    console.log('Migrations completed');
    await db.seed.run();
    console.log('Seeds completed');
  } catch (err) {
    console.error('Migration/seed error:', err);
  }

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start();

export default app;

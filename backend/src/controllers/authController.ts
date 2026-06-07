import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { requireAuth } from '../middleware/auth';

const router = Router();

const isProd = process.env.NODE_ENV === 'production';

// В production фронтенд и бэкенд на разных доменах (cross-site),
// поэтому нужен SameSite=None; Secure чтобы cookie отправлялась.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24h
};

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }
  try {
    const { token, user } = await AuthService.login(email, password);
    res.cookie('token', token, COOKIE_OPTIONS);
    return res.json(user);
  } catch {
    // Намеренно не раскрываем, какое поле неверно
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(token) as any;
      if (payload?.jti) await AuthService.logout(payload.jti);
    } catch { /* ignore */ }
  }
  res.clearCookie('token', { httpOnly: true, secure: isProd, sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax' });
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json((req as any).user);
});

export default router;

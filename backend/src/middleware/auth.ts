import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const user = await AuthService.validateToken(token);
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

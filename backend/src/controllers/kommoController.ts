import { Router, Request, Response } from 'express';
import { KommoService } from '../services/KommoService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/integrations/kommo/status — статусы всех филиалов (защищено)
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const statuses = await KommoService.getStatuses();
    return res.json(statuses);
  } catch (err: any) {
    console.error('[KOMMO] status error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/kommo/connect/:branchId — возвращает URL для OAuth (защищено)
router.get('/connect/:branchId', requireAuth, (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  const authUrl = KommoService.buildAuthUrl(branchId);
  return res.json({ authUrl });
});

// GET /api/integrations/kommo/callback — Kommo редиректит сюда после consent (публичный)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, referer } = req.query as Record<string, string>;
  console.log('[KOMMO] callback:', { hasCode: !!code, state, referer });

  if (!code || !state || !referer) {
    return res.status(400).send('Missing code, state or referer');
  }

  try {
    const { branchId } = KommoService.decodeState(state);
    await KommoService.exchangeCode(code, referer, branchId);
    // Возвращаем пользователя на страницу интеграций фронтенда
    const frontend = process.env.FRONTEND_URL || 'https://rsu4udata.com';
    return res.redirect(`${frontend}/dashboard/integrations?kommo=connected&branch=${branchId}`);
  } catch (err: any) {
    console.error('[KOMMO] callback error:', err.message);
    const frontend = process.env.FRONTEND_URL || 'https://rsu4udata.com';
    return res.redirect(`${frontend}/dashboard/integrations?kommo=error`);
  }
});

export default router;

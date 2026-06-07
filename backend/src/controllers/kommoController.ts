import { Router, Request, Response } from 'express';
import { KommoService } from '../services/KommoService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/integrations/kommo/status — статусы всех филиалов
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const statuses = await KommoService.getStatuses();
    return res.json({ statuses, redirectUri: KommoService.redirectUri() });
  } catch (err: any) {
    console.error('[KOMMO] status error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/kommo/leads-daily/:branchId — лиды по тегу за N дней по дням
router.get('/leads-daily/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  const days = Number(req.query.days) || 14;
  const tag = (req.query.tag as string) || 'РЕКЛАМА';
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  try {
    const result = await KommoService.getLeadsByTagDaily(branchId, days, tag);
    return res.json(result);
  } catch (err: any) {
    console.error('[KOMMO] leads-daily error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/integrations/kommo/test/:branchId — проверка реальных данных
router.get('/test/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  try {
    const result = await KommoService.testConnection(branchId);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/integrations/kommo/token/:branchId — сохранить long-lived токен (простой способ)
router.post('/token/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  const { baseDomain, token } = req.body;
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  if (!baseDomain || !token) {
    return res.status(400).json({ error: 'Домен аккаунта и токен обязательны' });
  }
  try {
    await KommoService.saveLongLivedToken(branchId, baseDomain, token);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[KOMMO] save token error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/integrations/kommo/credentials/:branchId — сохранить client_id/secret
router.post('/credentials/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  const { clientId, clientSecret } = req.body;
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'clientId и clientSecret обязательны' });
  }
  try {
    await KommoService.saveCredentials(branchId, clientId, clientSecret);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[KOMMO] save credentials error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/kommo/connect/:branchId — URL для OAuth
router.get('/connect/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  try {
    const authUrl = await KommoService.buildAuthUrl(branchId);
    return res.json({ authUrl });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/integrations/kommo/callback — Kommo редиректит после consent
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, referer } = req.query as Record<string, string>;
  console.log('[KOMMO] callback:', { hasCode: !!code, state, referer });

  const frontend = process.env.FRONTEND_URL || 'https://rsu4udata.com';

  if (!code || !state || !referer) {
    return res.redirect(`${frontend}/dashboard/integrations?kommo=error`);
  }

  try {
    const { branchId } = KommoService.decodeState(state);
    await KommoService.exchangeCode(code, referer, branchId);
    return res.redirect(`${frontend}/dashboard/integrations?kommo=connected&branch=${branchId}`);
  } catch (err: any) {
    console.error('[KOMMO] callback error:', err.message);
    return res.redirect(`${frontend}/dashboard/integrations?kommo=error`);
  }
});

export default router;

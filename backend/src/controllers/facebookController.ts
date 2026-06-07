import { Router, Request, Response } from 'express';
import { FacebookService } from '../services/FacebookService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/integrations/facebook/status
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const status = await FacebookService.getStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/facebook/connect  { adAccountId, token }
router.post('/connect', requireAuth, async (req: Request, res: Response) => {
  const { adAccountId, token } = req.body;
  if (!adAccountId || !token) {
    return res.status(400).json({ error: 'Ad Account ID и токен обязательны' });
  }
  try {
    const result = await FacebookService.saveCredentials(adAccountId, token);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[FB] connect error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/integrations/facebook/test
router.get('/test', requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await FacebookService.testConnection();
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/integrations/facebook/spend-daily?days=14
router.get('/spend-daily', requireAuth, async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 14;
  try {
    const result = await FacebookService.getSpendDaily(days);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/integrations/facebook/campaigns — список кампаний из FB
router.get('/campaigns', requireAuth, async (_req: Request, res: Response) => {
  try {
    const campaigns = await FacebookService.listCampaigns();
    return res.json(campaigns);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/integrations/facebook/campaign-map — привязки городов
router.get('/campaign-map', requireAuth, async (_req: Request, res: Response) => {
  try {
    const map = await FacebookService.getCampaignMap();
    return res.json(map);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/facebook/campaign-map/:branchId — сохранить привязку
router.post('/campaign-map/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  const { campaignNames } = req.body;
  if (![1, 2, 3, 4].includes(branchId)) {
    return res.status(400).json({ error: 'Invalid branchId' });
  }
  if (!Array.isArray(campaignNames)) {
    return res.status(400).json({ error: 'campaignNames должен быть массивом' });
  }
  try {
    await FacebookService.saveCampaignMap(branchId, campaignNames);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/facebook/city-spend/:branchId?days=14
router.get('/city-spend/:branchId', requireAuth, async (req: Request, res: Response) => {
  const branchId = Number(req.params.branchId);
  const days = Number(req.query.days) || 14;
  try {
    const result = await FacebookService.getCitySpend(branchId, days);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

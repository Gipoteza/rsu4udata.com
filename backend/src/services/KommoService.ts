import db from '../database/db';
import { OAuthHelper } from './OAuthHelper';

const REDIRECT_URI = process.env.KOMMO_REDIRECT_URI
  || 'https://api.rsu4udata.com/api/integrations/kommo/callback';

interface KommoTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export const KommoService = {
  // Сохраняет long-lived токен напрямую (простой способ без OAuth).
  // Проверяет токен запросом к Kommo API /api/v4/account.
  async saveLongLivedToken(branchId: number, baseDomainRaw: string, token: string): Promise<void> {
    let baseDomain = baseDomainRaw.trim().replace(/\/+$/, '');
    if (!baseDomain.startsWith('http')) baseDomain = `https://${baseDomain}`;

    // Проверяем токен
    const resp = await fetch(`${baseDomain}/api/v4/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      throw new Error(`Kommo не принял токен (${resp.status}). Проверьте домен и Long-lived token.`);
    }

    const existing = await db('kommo_accounts').where({ branch_id: branchId }).first();
    const data = {
      branch_id: branchId,
      base_domain: baseDomain,
      access_token_enc: OAuthHelper.encrypt(token),
      refresh_token_enc: OAuthHelper.encrypt(''), // long-lived не требует refresh
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // ~1 год
      status: 'connected',
      updated_at: db.fn.now(),
    };
    if (existing) {
      await db('kommo_accounts').where({ branch_id: branchId }).update(data);
    } else {
      await db('kommo_accounts').insert({ ...data, status: 'connected', created_at: db.fn.now() });
    }
  },

  // Сохраняет client_id и client_secret для филиала (вводятся в админке)
  async saveCredentials(branchId: number, clientId: string, clientSecret: string): Promise<void> {
    const existing = await db('kommo_accounts').where({ branch_id: branchId }).first();
    const data = {
      branch_id: branchId,
      client_id: clientId,
      client_secret_enc: OAuthHelper.encrypt(clientSecret),
      updated_at: db.fn.now(),
    };
    if (existing) {
      await db('kommo_accounts').where({ branch_id: branchId }).update(data);
    } else {
      await db('kommo_accounts').insert({ ...data, status: 'not_connected', created_at: db.fn.now() });
    }
  },

  // Формирует OAuth URL, используя client_id конкретного филиала
  async buildAuthUrl(branchId: number): Promise<string> {
    const acc = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (!acc || !acc.client_id) {
      throw new Error('Сначала введите client_id и client_secret для этого города');
    }
    const state = Buffer.from(JSON.stringify({ branchId })).toString('base64');
    const params = new URLSearchParams({
      client_id: acc.client_id,
      state,
      mode: 'post_message',
    });
    return `https://www.kommo.com/oauth?${params.toString()}`;
  },

  decodeState(state: string): { branchId: number } {
    return JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
  },

  // Обмен authorization code на токены, используя credentials филиала
  async exchangeCode(code: string, referer: string, branchId: number): Promise<void> {
    const acc = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (!acc || !acc.client_id || !acc.client_secret_enc) {
      throw new Error('Credentials не найдены для филиала');
    }
    const clientSecret = OAuthHelper.decrypt(acc.client_secret_enc);
    const baseDomain = referer.startsWith('http') ? referer : `https://${referer}`;

    const resp = await fetch(`${baseDomain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: acc.client_id,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Kommo token exchange failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as KommoTokenResponse;
    await db('kommo_accounts').where({ branch_id: branchId }).update({
      base_domain: baseDomain,
      access_token_enc: OAuthHelper.encrypt(data.access_token),
      refresh_token_enc: OAuthHelper.encrypt(data.refresh_token),
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      status: 'connected',
      updated_at: db.fn.now(),
    });
  },

  async refreshTokenIfNeeded(branchId: number): Promise<void> {
    const acc = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (!acc || !acc.refresh_token_enc) throw new Error('Kommo account not connected');

    const expiresAt = new Date(acc.expires_at).getTime();
    if (expiresAt - Date.now() > 60_000) return;

    const clientSecret = OAuthHelper.decrypt(acc.client_secret_enc);
    const refreshToken = OAuthHelper.decrypt(acc.refresh_token_enc);

    const resp = await fetch(`${acc.base_domain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: acc.client_id,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!resp.ok) {
      await db('kommo_accounts').where({ branch_id: branchId }).update({ status: 'requires_reconnect' });
      throw new Error(`Kommo token refresh failed: ${resp.status}`);
    }

    const data = (await resp.json()) as KommoTokenResponse;
    await db('kommo_accounts').where({ branch_id: branchId }).update({
      access_token_enc: OAuthHelper.encrypt(data.access_token),
      refresh_token_enc: OAuthHelper.encrypt(data.refresh_token),
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      status: 'connected',
      updated_at: db.fn.now(),
    });
  },

  async getStatuses() {
    const branches = await db('branches').select('id', 'name').orderBy('id');
    const accounts = await db('kommo_accounts').select(
      'branch_id', 'client_id', 'base_domain', 'status', 'updated_at'
    );
    const byBranch = new Map(accounts.map((a) => [a.branch_id, a]));

    return branches.map((b) => {
      const acc = byBranch.get(b.id);
      return {
        branchId: b.id,
        branchName: b.name,
        status: acc?.status || 'not_connected',
        clientId: acc?.client_id || null,
        hasCredentials: !!acc?.client_id,
        baseDomain: acc?.base_domain || null,
        lastSyncedAt: acc?.updated_at || null,
      };
    });
  },

  redirectUri(): string {
    return REDIRECT_URI;
  },
};

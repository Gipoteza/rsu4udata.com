import db from '../database/db';
import { OAuthHelper } from './OAuthHelper';

const CLIENT_ID = process.env.KOMMO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.KOMMO_REDIRECT_URI || 'https://rsu4udatacombackend-production.up.railway.app/api/integrations/kommo/callback';

interface KommoTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export const KommoService = {
  // Формирует URL для OAuth-авторизации Kommo.
  // state кодирует branchId, чтобы callback знал к какому филиалу привязать аккаунт.
  buildAuthUrl(branchId: number): string {
    const state = Buffer.from(JSON.stringify({ branchId })).toString('base64');
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      state,
      mode: 'post_message',
    });
    return `https://www.kommo.com/oauth?${params.toString()}`;
  },

  decodeState(state: string): { branchId: number } {
    return JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
  },

  // Обмен authorization code на токены.
  // referer — субдомен аккаунта Kommo (например mycompany.kommo.com), приходит в callback.
  async exchangeCode(code: string, referer: string, branchId: number): Promise<void> {
    const baseDomain = referer.startsWith('http') ? referer : `https://${referer}`;
    const resp = await fetch(`${baseDomain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
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
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    const record = {
      branch_id: branchId,
      base_domain: baseDomain,
      access_token_enc: OAuthHelper.encrypt(data.access_token),
      refresh_token_enc: OAuthHelper.encrypt(data.refresh_token),
      expires_at: expiresAt,
      status: 'connected',
      updated_at: db.fn.now(),
    };

    const existing = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (existing) {
      await db('kommo_accounts').where({ branch_id: branchId }).update(record);
    } else {
      await db('kommo_accounts').insert({ ...record, created_at: db.fn.now() });
    }
  },

  // Обновляет access_token по refresh_token, если истекает.
  async refreshTokenIfNeeded(branchId: number): Promise<void> {
    const acc = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (!acc) throw new Error('Kommo account not found');

    const expiresAt = new Date(acc.expires_at).getTime();
    if (expiresAt - Date.now() > 60_000) return; // ещё больше минуты — не обновляем

    const refreshToken = OAuthHelper.decrypt(acc.refresh_token_enc);
    const resp = await fetch(`${acc.base_domain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
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

  // Статусы всех филиалов для страницы интеграций.
  async getStatuses() {
    const branches = await db('branches').select('id', 'name').orderBy('id');
    const accounts = await db('kommo_accounts').select('branch_id', 'base_domain', 'status', 'updated_at');
    const byBranch = new Map(accounts.map((a) => [a.branch_id, a]));

    return branches.map((b) => {
      const acc = byBranch.get(b.id);
      return {
        branchId: b.id,
        branchName: b.name,
        status: acc?.status || 'not_connected',
        baseDomain: acc?.base_domain || null,
        lastSyncedAt: acc?.updated_at || null,
      };
    });
  },
};

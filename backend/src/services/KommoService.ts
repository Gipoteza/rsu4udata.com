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

  // Проверка подключения — тянет реальные данные из Kommo (название аккаунта + счётчики)
  async testConnection(branchId: number) {
    const acc = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (!acc || !acc.access_token_enc) throw new Error('Аккаунт не подключён');

    const token = OAuthHelper.decrypt(acc.access_token_enc);
    const headers = { Authorization: `Bearer ${token}` };

    // Информация об аккаунте
    const accountResp = await fetch(`${acc.base_domain}/api/v4/account`, { headers });
    if (!accountResp.ok) {
      await db('kommo_accounts').where({ branch_id: branchId }).update({ status: 'requires_reconnect' });
      throw new Error(`Kommo вернул ${accountResp.status}. Токен недействителен.`);
    }
    const account = (await accountResp.json()) as any;

    // Лиды (первая страница) — чтобы показать что данные читаются
    const leadsResp = await fetch(`${acc.base_domain}/api/v4/leads?limit=1`, { headers });
    let leadsAvailable = false;
    let leadsSample: any = null;
    if (leadsResp.ok) {
      leadsAvailable = true;
      const leadsData = (await leadsResp.json()) as any;
      const first = leadsData?._embedded?.leads?.[0];
      if (first) {
        leadsSample = { id: first.id, name: first.name, price: first.price, created_at: first.created_at };
      }
    }

    return {
      accountName: account.name,
      subdomain: account.subdomain,
      accountId: account.id,
      leadsAvailable,
      leadsSample,
    };
  },

  // Возвращает количество лидов с заданным тегом за последние N дней,
  // сгруппированное по дням (от сегодня назад).
  async getLeadsByTagDaily(branchId: number, days = 14, tagName = 'РЕКЛАМА') {
    const acc = await db('kommo_accounts').where({ branch_id: branchId }).first();
    if (!acc || !acc.access_token_enc) throw new Error('Аккаунт не подключён');

    const token = OAuthHelper.decrypt(acc.access_token_enc);
    const headers = { Authorization: `Bearer ${token}` };

    // Границы периода (по локальным дням)
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const fromDate = new Date(todayEnd);
    fromDate.setDate(fromDate.getDate() - (days - 1));
    fromDate.setHours(0, 0, 0, 0);

    const fromTs = Math.floor(fromDate.getTime() / 1000);
    const toTs = Math.floor(todayEnd.getTime() / 1000);

    // Готовим карту дней: YYYY-MM-DD -> count
    const counts = new Map<string, number>();
    const labels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayEnd);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      counts.set(key, 0);
      labels.push(key);
    }

    const tagLower = tagName.toLowerCase();
    let page = 1;
    const maxPages = 40; // защита от бесконечного цикла

    while (page <= maxPages) {
      const url = `${acc.base_domain}/api/v4/leads?with=tags&limit=250&page=${page}`
        + `&filter[created_at][from]=${fromTs}&filter[created_at][to]=${toTs}`;
      const resp = await fetch(url, { headers });
      if (resp.status === 204) break; // нет данных
      if (!resp.ok) {
        throw new Error(`Kommo вернул ${resp.status} при запросе лидов`);
      }
      const data = (await resp.json()) as any;
      const leads: any[] = data?._embedded?.leads || [];
      if (leads.length === 0) break;

      for (const lead of leads) {
        const tags: any[] = lead?._embedded?.tags || [];
        const hasTag = tags.some((t) => String(t.name || '').toLowerCase() === tagLower);
        if (!hasTag) continue;
        const createdTs = Number(lead.created_at) * 1000;
        const key = new Date(createdTs).toISOString().slice(0, 10);
        if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      }

      // Если есть следующая страница — продолжаем
      const hasNext = !!data?._links?.next;
      if (!hasNext) break;
      page++;
    }

    const series = labels.map((k) => counts.get(k) || 0);
    const total = series.reduce((a, b) => a + b, 0);

    return {
      tag: tagName,
      days,
      labels, // YYYY-MM-DD от старого к сегодня
      series, // количество лидов по дням
      total,
    };
  },

  redirectUri(): string {
    return REDIRECT_URI;
  },
};

import db from '../database/db';
import { OAuthHelper } from './OAuthHelper';

const GRAPH = 'https://graph.facebook.com/v21.0';

// Один общий аккаунт Facebook Ads. Храним в facebook_accounts с id=1.
const SINGLETON_ID = 1;

function normalizeActId(raw: string): string {
  const id = raw.trim().replace(/^act_/, '');
  return `act_${id}`;
}

export const FacebookService = {
  // Сохраняет access token + ad account id, проверяя через Graph API.
  async saveCredentials(adAccountIdRaw: string, token: string): Promise<{ name: string }> {
    const actId = normalizeActId(adAccountIdRaw);

    // Проверяем токен и доступ к рекламному аккаунту
    const resp = await fetch(`${GRAPH}/${actId}?fields=name,account_status&access_token=${encodeURIComponent(token)}`);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Facebook не принял данные (${resp.status}). Проверьте Ad Account ID и токен. ${text.slice(0, 200)}`);
    }
    const acc = (await resp.json()) as any;

    const existing = await db('facebook_accounts').where({ id: SINGLETON_ID }).first();
    const data = {
      id: SINGLETON_ID,
      ad_account_id: actId,
      account_name: acc.name || actId,
      access_token_enc: OAuthHelper.encrypt(token),
      status: 'connected',
      updated_at: db.fn.now(),
    };
    if (existing) {
      await db('facebook_accounts').where({ id: SINGLETON_ID }).update(data);
    } else {
      await db('facebook_accounts').insert({ ...data, created_at: db.fn.now() });
    }
    return { name: acc.name || actId };
  },

  async getStatus() {
    const acc = await db('facebook_accounts').where({ id: SINGLETON_ID }).first();
    if (!acc) {
      return { status: 'not_connected', adAccountId: null, accountName: null, lastSyncedAt: null };
    }
    return {
      status: acc.status || 'not_connected',
      adAccountId: acc.ad_account_id,
      accountName: acc.account_name,
      lastSyncedAt: acc.updated_at,
    };
  },

  // Проверка — тянет insights за последние 14 дней
  async testConnection() {
    const acc = await db('facebook_accounts').where({ id: SINGLETON_ID }).first();
    if (!acc || !acc.access_token_enc) throw new Error('Facebook не подключён');

    const token = OAuthHelper.decrypt(acc.access_token_enc);
    const url = `${GRAPH}/${acc.ad_account_id}/insights`
      + `?fields=spend,impressions,clicks,cpc,ctr&date_preset=last_14d&access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      await db('facebook_accounts').where({ id: SINGLETON_ID }).update({ status: 'requires_reconnect' });
      throw new Error(`Facebook вернул ${resp.status}. Токен недействителен.`);
    }
    const data = (await resp.json()) as any;
    const row = data?.data?.[0];
    return {
      accountName: acc.account_name,
      adAccountId: acc.ad_account_id,
      spend: row?.spend ?? null,
      impressions: row?.impressions ?? null,
      clicks: row?.clicks ?? null,
      ctr: row?.ctr ?? null,
    };
  },

  // Spend по дням за N дней (для графика)
  async getSpendDaily(days = 14) {
    const acc = await db('facebook_accounts').where({ id: SINGLETON_ID }).first();
    if (!acc || !acc.access_token_enc) throw new Error('Facebook не подключён');

    const token = OAuthHelper.decrypt(acc.access_token_enc);
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceStr = since.toISOString().slice(0, 10);
    const untilStr = new Date().toISOString().slice(0, 10);

    const url = `${GRAPH}/${acc.ad_account_id}/insights`
      + `?fields=spend,impressions,clicks&time_increment=1`
      + `&time_range={'since':'${sinceStr}','until':'${untilStr}'}`
      + `&access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Facebook вернул ${resp.status} при запросе insights`);
    }
    const data = (await resp.json()) as any;
    const rows: any[] = data?.data || [];

    // Карта день -> spend
    const byDay = new Map<string, number>();
    rows.forEach((r) => {
      byDay.set(r.date_start, Number(r.spend) || 0);
    });

    const labels: string[] = [];
    const series: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      series.push(byDay.get(key) || 0);
    }
    return { days, labels, series, total: series.reduce((a, b) => a + b, 0) };
  },
};

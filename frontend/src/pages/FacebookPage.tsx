import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface FbStatus {
  status: 'connected' | 'requires_reconnect' | 'not_connected';
  adAccountId: string | null;
  accountName: string | null;
  lastSyncedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Подключён',
  requires_reconnect: 'Требует переподключения',
  not_connected: 'Не подключён',
};
const STATUS_COLOR: Record<string, string> = {
  connected: '#16a34a',
  requires_reconnect: '#ea580c',
  not_connected: '#94a3b8',
};

export default function FacebookPage() {
  const [status, setStatus] = useState<FbStatus | null>(null);
  const [adAccountId, setAdAccountId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testResult, setTestResult] = useState('');

  const load = async () => {
    try {
      const res = await api.get<FbStatus>('/integrations/facebook/status');
      setStatus(res.data);
      if (res.data.adAccountId) setAdAccountId(res.data.adAccountId.replace('act_', ''));
    } catch {
      setError('Не удалось загрузить статус');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!adAccountId || !token) {
      setError('Введите Ad Account ID и токен');
      return;
    }
    setError(''); setNotice(''); setSaving(true);
    try {
      const res = await api.post('/integrations/facebook/connect', { adAccountId, token });
      setNotice(`Facebook подключён: ${res.data.name}`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не удалось подключить');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult('Проверка...');
    try {
      const res = await api.get('/integrations/facebook/test');
      const d = res.data;
      setTestResult(`✓ ${d.accountName} (${d.adAccountId}). За 14 дней: расход ${d.spend ?? 0}, показы ${d.impressions ?? 0}, клики ${d.clicks ?? 0}`);
    } catch (e: any) {
      setTestResult('✗ ' + (e.response?.data?.error || 'Ошибка проверки'));
    }
  };

  if (loading) return <div style={styles.loading}>Загрузка...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Facebook Ads</h1>
      <p style={styles.subtitle}>Подключение рекламного аккаунта Facebook</p>

      <div style={styles.infoBox}>
        <strong>Где взять:</strong> в Facebook Business → Ads Manager URL содержит <code>act_XXXXXXXX</code> — это Ad Account ID.
        Access token создаётся в <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a> с правами <code>ads_read</code>.
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.label2}>Статус</span>
          <span style={{ ...styles.badge, backgroundColor: STATUS_COLOR[status?.status || 'not_connected'] }}>
            {STATUS_LABEL[status?.status || 'not_connected']}
          </span>
        </div>

        <label style={styles.label}>Ad Account ID</label>
        <div style={styles.actRow}>
          <span style={styles.actPrefix}>act_</span>
          <input
            style={{ ...styles.input, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            value={adAccountId}
            onChange={(e) => setAdAccountId(e.target.value.replace('act_', ''))}
            placeholder="123456789"
          />
        </div>

        <label style={styles.label}>Access Token</label>
        <input
          style={styles.input}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={status?.status === 'connected' ? '•••••••• (подключён)' : 'EAAG...'}
        />

        <button style={styles.saveButton} disabled={saving} onClick={handleSave}>
          {saving ? 'Проверка...' : status?.status === 'connected' ? 'Обновить токен' : 'Подключить Facebook'}
        </button>

        {status?.status === 'connected' && (
          <button style={styles.testButton} onClick={handleTest}>Проверить данные</button>
        )}
        {testResult && <div style={styles.testResult}>{testResult}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: '520px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 20px 0' },
  loading: { padding: '32px', color: '#8892a4' },
  infoBox: {
    padding: '12px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
    borderRadius: '8px', fontSize: '13px', color: '#0c4a6e', marginBottom: '16px', lineHeight: 1.5,
  },
  notice: {
    padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '8px', color: '#15803d', fontSize: '14px', marginBottom: '16px',
  },
  error: {
    padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px',
  },
  card: {
    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  label2: { fontSize: '15px', fontWeight: 600, color: '#1a1a2e' },
  badge: { fontSize: '11px', fontWeight: 600, color: '#fff', padding: '4px 10px', borderRadius: '12px' },
  label: { fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '4px' },
  actRow: { display: 'flex', alignItems: 'stretch' },
  actPrefix: {
    display: 'flex', alignItems: 'center', padding: '0 10px', background: '#f1f5f9',
    border: '1px solid #e2e8f0', borderRight: 'none', borderRadius: '8px 0 0 8px',
    fontSize: '13px', color: '#64748b',
  },
  input: {
    flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa',
  },
  saveButton: {
    padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: '#1877f2',
    color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '12px',
  },
  testButton: {
    padding: '9px', border: '1px solid #1877f2', borderRadius: '8px', background: '#fff',
    color: '#1877f2', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
  },
  testResult: {
    marginTop: '8px', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '6px',
    fontSize: '12px', color: '#334155', lineHeight: 1.4,
  },
};

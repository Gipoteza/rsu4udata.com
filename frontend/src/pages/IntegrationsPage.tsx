import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface BranchStatus {
  branchId: number;
  branchName: string;
  status: 'connected' | 'requires_reconnect' | 'not_connected';
  clientId: string | null;
  hasCredentials: boolean;
  baseDomain: string | null;
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

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<BranchStatus[]>([]);
  const [redirectUri, setRedirectUri] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Локальные значения форм для каждого филиала
  const [forms, setForms] = useState<Record<number, { clientId: string; clientSecret: string; saving: boolean }>>({});

  const loadStatuses = async () => {
    try {
      const res = await api.get<{ statuses: BranchStatus[]; redirectUri: string }>('/integrations/kommo/status');
      setStatuses(res.data.statuses);
      setRedirectUri(res.data.redirectUri);
      // Инициализируем формы
      const init: Record<number, { clientId: string; clientSecret: string; saving: boolean }> = {};
      res.data.statuses.forEach((s) => {
        init[s.branchId] = { clientId: s.clientId || '', clientSecret: '', saving: false };
      });
      setForms(init);
    } catch {
      setError('Не удалось загрузить статусы интеграций');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
    // Проверяем результат OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('kommo') === 'connected') {
      setNotice('Kommo успешно подключён!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('kommo') === 'error') {
      setError('Ошибка подключения Kommo. Проверьте client_id/secret и redirect URI.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const updateForm = (branchId: number, field: 'clientId' | 'clientSecret', value: string) => {
    setForms((prev) => ({
      ...prev,
      [branchId]: { ...prev[branchId], [field]: value },
    }));
  };

  const handleSaveCredentials = async (branchId: number) => {
    const form = forms[branchId];
    if (!form?.clientId || !form?.clientSecret) {
      setError('Введите client_id и client_secret');
      return;
    }
    setError('');
    setForms((prev) => ({ ...prev, [branchId]: { ...prev[branchId], saving: true } }));
    try {
      await api.post(`/integrations/kommo/credentials/${branchId}`, {
        clientId: form.clientId,
        clientSecret: form.clientSecret,
      });
      setNotice('Данные сохранены. Теперь нажмите "Подключить Kommo".');
      await loadStatuses();
    } catch {
      setError('Не удалось сохранить данные');
    } finally {
      setForms((prev) => ({ ...prev, [branchId]: { ...prev[branchId], saving: false } }));
    }
  };

  const handleConnect = async (branchId: number) => {
    setError('');
    try {
      const res = await api.get<{ authUrl: string }>(`/integrations/kommo/connect/${branchId}`);
      window.open(res.data.authUrl, '_blank', 'width=750,height=580');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не удалось начать подключение');
    }
  };

  if (loading) return <div style={styles.loading}>Загрузка...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Интеграции Kommo</h1>
      <p style={styles.subtitle}>Подключение CRM Kommo для каждого города</p>

      {redirectUri && (
        <div style={styles.infoBox}>
          <strong>Redirect URI</strong> для настройки интеграции в Kommo:
          <code style={styles.code}>{redirectUri}</code>
        </div>
      )}

      {notice && <div style={styles.notice}>{notice}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {statuses.map((b) => {
          const form = forms[b.branchId] || { clientId: '', clientSecret: '', saving: false };
          return (
            <div key={b.branchId} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.branchName}>{b.branchName}</span>
                <span style={{ ...styles.badge, backgroundColor: STATUS_COLOR[b.status] }}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>

              {b.baseDomain && (
                <div style={styles.domain}>{b.baseDomain.replace('https://', '')}</div>
              )}

              <label style={styles.label}>Client ID (Integration ID)</label>
              <input
                style={styles.input}
                value={form.clientId}
                onChange={(e) => updateForm(b.branchId, 'clientId', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx..."
              />

              <label style={styles.label}>Client Secret</label>
              <input
                style={styles.input}
                type="password"
                value={form.clientSecret}
                onChange={(e) => updateForm(b.branchId, 'clientSecret', e.target.value)}
                placeholder={b.hasCredentials ? '•••••••• (сохранён)' : 'Secret key'}
              />

              <button
                style={styles.saveButton}
                disabled={form.saving}
                onClick={() => handleSaveCredentials(b.branchId)}
              >
                {form.saving ? 'Сохранение...' : 'Сохранить данные'}
              </button>

              <button
                style={{
                  ...styles.connectButton,
                  opacity: b.hasCredentials ? 1 : 0.5,
                  cursor: b.hasCredentials ? 'pointer' : 'not-allowed',
                }}
                disabled={!b.hasCredentials}
                onClick={() => handleConnect(b.branchId)}
              >
                {b.status === 'connected' ? 'Переподключить Kommo' : 'Подключить Kommo'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 20px 0' },
  loading: { padding: '32px', color: '#8892a4' },
  infoBox: {
    padding: '12px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
    borderRadius: '8px', fontSize: '13px', color: '#0c4a6e', marginBottom: '16px',
  },
  code: {
    display: 'block', marginTop: '6px', padding: '6px 10px', backgroundColor: '#fff',
    borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', color: '#0369a1', wordBreak: 'break-all',
  },
  notice: {
    padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '8px', color: '#15803d', fontSize: '14px', marginBottom: '16px',
  },
  error: {
    padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: {
    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  branchName: { fontSize: '17px', fontWeight: 600, color: '#1a1a2e' },
  badge: { fontSize: '11px', fontWeight: 600, color: '#fff', padding: '4px 10px', borderRadius: '12px' },
  domain: { fontSize: '13px', color: '#64748b', marginBottom: '4px' },
  label: { fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '4px' },
  input: {
    padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa',
  },
  saveButton: {
    padding: '9px', border: '1px solid #4f46e5', borderRadius: '8px', backgroundColor: '#fff',
    color: '#4f46e5', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
  },
  connectButton: {
    padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5',
    color: '#fff', fontSize: '14px', fontWeight: 600, marginTop: '4px',
  },
};

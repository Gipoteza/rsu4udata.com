import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface BranchStatus {
  branchId: number;
  branchName: string;
  status: 'connected' | 'requires_reconnect' | 'not_connected';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [forms, setForms] = useState<Record<number, { baseDomain: string; token: string; saving: boolean }>>({});
  const [testResult, setTestResult] = useState<Record<number, string>>({});

  const loadStatuses = async () => {
    try {
      const res = await api.get<{ statuses: BranchStatus[] }>('/integrations/kommo/status');
      setStatuses(res.data.statuses);
      const init: Record<number, { baseDomain: string; token: string; saving: boolean }> = {};
      res.data.statuses.forEach((s) => {
        init[s.branchId] = { baseDomain: s.baseDomain?.replace('https://', '') || '', token: '', saving: false };
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
  }, []);

  const updateForm = (branchId: number, field: 'baseDomain' | 'token', value: string) => {
    setForms((prev) => ({ ...prev, [branchId]: { ...prev[branchId], [field]: value } }));
  };

  const handleSave = async (branchId: number) => {
    const form = forms[branchId];
    if (!form?.baseDomain || !form?.token) {
      setError('Введите домен аккаунта и Long-lived token');
      return;
    }
    setError('');
    setNotice('');
    setForms((prev) => ({ ...prev, [branchId]: { ...prev[branchId], saving: true } }));
    try {
      await api.post(`/integrations/kommo/token/${branchId}`, {
        baseDomain: form.baseDomain,
        token: form.token,
      });
      setNotice('Аккаунт Kommo успешно подключён!');
      await loadStatuses();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не удалось подключить');
    } finally {
      setForms((prev) => ({ ...prev, [branchId]: { ...prev[branchId], saving: false } }));
    }
  };

  const handleTest = async (branchId: number) => {
    setTestResult((prev) => ({ ...prev, [branchId]: 'Проверка...' }));
    try {
      const res = await api.get(`/integrations/kommo/test/${branchId}`);
      const d = res.data;
      const sample = d.leadsSample
        ? ` Пример сделки: «${d.leadsSample.name || 'без названия'}» (id ${d.leadsSample.id})`
        : '';
      setTestResult((prev) => ({
        ...prev,
        [branchId]: `✓ ${d.accountName} (${d.subdomain}). Лиды доступны: ${d.leadsAvailable ? 'да' : 'нет'}.${sample}`,
      }));
    } catch (e: any) {
      setTestResult((prev) => ({ ...prev, [branchId]: '✗ ' + (e.response?.data?.error || 'Ошибка проверки') }));
    }
  };

  if (loading) return <div style={styles.loading}>Загрузка...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Интеграции Kommo</h1>
      <p style={styles.subtitle}>Подключение CRM Kommo для каждого города через Long-lived token</p>

      <div style={styles.infoBox}>
        <strong>Где взять данные:</strong> в Kommo откройте вашу интеграцию → вкладка «Ключи и доступы».
        Скопируйте <b>Long-lived token</b> и укажите домен аккаунта (например <code>company.kommo.com</code>).
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {statuses.map((b) => {
          const form = forms[b.branchId] || { baseDomain: '', token: '', saving: false };
          return (
            <div key={b.branchId} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.branchName}>{b.branchName}</span>
                <span style={{ ...styles.badge, backgroundColor: STATUS_COLOR[b.status] }}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>

              <label style={styles.label}>Домен аккаунта Kommo</label>
              <input
                style={styles.input}
                value={form.baseDomain}
                onChange={(e) => updateForm(b.branchId, 'baseDomain', e.target.value)}
                placeholder="company.kommo.com"
              />

              <label style={styles.label}>Long-lived token</label>
              <input
                style={styles.input}
                type="password"
                value={form.token}
                onChange={(e) => updateForm(b.branchId, 'token', e.target.value)}
                placeholder={b.status === 'connected' ? '•••••••• (подключён)' : 'eyJ0eXAiOiJKV1Q...'}
              />

              <button
                style={styles.saveButton}
                disabled={form.saving}
                onClick={() => handleSave(b.branchId)}
              >
                {form.saving ? 'Проверка...' : b.status === 'connected' ? 'Обновить токен' : 'Подключить Kommo'}
              </button>

              {b.status === 'connected' && (
                <button style={styles.testButton} onClick={() => handleTest(b.branchId)}>
                  Проверить данные
                </button>
              )}

              {testResult[b.branchId] && (
                <div style={styles.testResult}>{testResult[b.branchId]}</div>
              )}
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: {
    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  branchName: { fontSize: '17px', fontWeight: 600, color: '#1a1a2e' },
  badge: { fontSize: '11px', fontWeight: 600, color: '#fff', padding: '4px 10px', borderRadius: '12px' },
  label: { fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '4px' },
  input: {
    padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa',
  },
  saveButton: {
    padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5',
    color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '12px',
  },
  testButton: {
    padding: '9px', border: '1px solid #4f46e5', borderRadius: '8px', background: '#fff',
    color: '#4f46e5', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
  },
  testResult: {
    marginTop: '8px', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '6px',
    fontSize: '12px', color: '#334155', lineHeight: 1.4,
  },
};

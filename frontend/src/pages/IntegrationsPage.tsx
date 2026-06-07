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

  const loadStatuses = async () => {
    try {
      const res = await api.get<BranchStatus[]>('/integrations/kommo/status');
      setStatuses(res.data);
    } catch {
      setError('Не удалось загрузить статусы интеграций');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  const handleConnect = async (branchId: number) => {
    try {
      const res = await api.get<{ authUrl: string }>(`/integrations/kommo/connect/${branchId}`);
      // Открываем OAuth Kommo в новом окне
      window.open(res.data.authUrl, '_blank', 'width=750,height=580');
    } catch {
      setError('Не удалось начать подключение');
    }
  };

  if (loading) return <div style={styles.loading}>Загрузка...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Интеграции</h1>
      <p style={styles.subtitle}>Подключение аккаунтов Kommo CRM к филиалам</p>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {statuses.map((b) => (
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

            <button
              style={{
                ...styles.button,
                backgroundColor: b.status === 'connected' ? '#f1f5f9' : '#4f46e5',
                color: b.status === 'connected' ? '#475569' : '#ffffff',
              }}
              onClick={() => handleConnect(b.branchId)}
            >
              {b.status === 'connected' ? 'Переподключить' : 'Подключить Kommo'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 24px 0' },
  loading: { padding: '32px', color: '#8892a4' },
  error: {
    padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: {
    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  branchName: { fontSize: '16px', fontWeight: 600, color: '#1a1a2e' },
  badge: { fontSize: '11px', fontWeight: 600, color: '#fff', padding: '4px 10px', borderRadius: '12px' },
  domain: { fontSize: '13px', color: '#64748b' },
  button: {
    padding: '10px', border: 'none', borderRadius: '8px', fontSize: '14px',
    fontWeight: 600, cursor: 'pointer', marginTop: '4px',
  },
};

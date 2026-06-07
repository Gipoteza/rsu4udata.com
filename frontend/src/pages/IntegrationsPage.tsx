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

  // Теги по городам
  const [availableTags, setAvailableTags] = useState<Record<number, { id: number; name: string }[]>>({});
  const [selectedTags, setSelectedTags] = useState<Record<number, Set<string>>>({});
  const [tagsLoading, setTagsLoading] = useState<Record<number, boolean>>({});
  const [tagsSaving, setTagsSaving] = useState<Record<number, boolean>>({});
  const [tagSearch, setTagSearch] = useState<Record<number, string>>({});

  const loadTagMap = async () => {
    try {
      const res = await api.get<{ branchId: number; tagNames: string[] }[]>('/integrations/kommo/tag-map');
      const sel: Record<number, Set<string>> = {};
      res.data.forEach((m) => { sel[m.branchId] = new Set(m.tagNames); });
      setSelectedTags(sel);
    } catch { /* пусто */ }
  };

  const loadTags = async (branchId: number) => {
    setTagsLoading((p) => ({ ...p, [branchId]: true }));
    try {
      const res = await api.get<{ id: number; name: string }[]>(`/integrations/kommo/tags/${branchId}`);
      setAvailableTags((p) => ({ ...p, [branchId]: res.data }));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не удалось загрузить теги');
    } finally {
      setTagsLoading((p) => ({ ...p, [branchId]: false }));
    }
  };

  const toggleTag = (branchId: number, name: string) => {
    setSelectedTags((prev) => {
      const set = new Set(prev[branchId] || []);
      if (set.has(name)) set.delete(name); else set.add(name);
      return { ...prev, [branchId]: set };
    });
  };

  const handleSaveTags = async (branchId: number) => {
    setTagsSaving((p) => ({ ...p, [branchId]: true }));
    setError(''); setNotice('');
    try {
      await api.post(`/integrations/kommo/tag-map/${branchId}`, {
        tagNames: Array.from(selectedTags[branchId] || []),
      });
      setNotice('Теги сохранены');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не удалось сохранить теги');
    } finally {
      setTagsSaving((p) => ({ ...p, [branchId]: false }));
    }
  };

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
    loadTagMap();
  }, []);

  // После загрузки статусов — подгружаем теги для подключённых городов
  useEffect(() => {
    statuses.forEach((s) => {
      if (s.status === 'connected' && !availableTags[s.branchId]) {
        loadTags(s.branchId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

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

  // Сортировка: выбранные вверху, затем по алфавиту. Плюс фильтр по поиску.
  const getVisibleTags = (branchId: number) => {
    const all = availableTags[branchId] || [];
    const sel = selectedTags[branchId] || new Set<string>();
    const query = (tagSearch[branchId] || '').toLowerCase().trim();

    const filtered = query
      ? all.filter((t) => t.name.toLowerCase().includes(query))
      : all;

    return [...filtered].sort((a, b) => {
      const aSel = sel.has(a.name) ? 0 : 1;
      const bSel = sel.has(b.name) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel; // выбранные вперёд
      return a.name.localeCompare(b.name, 'ru');
    });
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

              {b.status === 'connected' && (
                <div style={styles.tagsBlock}>
                  <div style={styles.tagsHeader}>
                    <span style={styles.tagsTitle}>Теги для графика</span>
                    <button
                      style={styles.tagsReload}
                      onClick={() => loadTags(b.branchId)}
                      disabled={tagsLoading[b.branchId]}
                    >
                      {tagsLoading[b.branchId] ? '...' : '⟳'}
                    </button>
                  </div>

                  <input
                    style={styles.tagSearch}
                    value={tagSearch[b.branchId] || ''}
                    onChange={(e) => setTagSearch((p) => ({ ...p, [b.branchId]: e.target.value }))}
                    placeholder="Поиск по тегам..."
                  />

                  <div style={styles.tagList}>
                    {getVisibleTags(b.branchId).map((t) => {
                      const checked = selectedTags[b.branchId]?.has(t.name) || false;
                      return (
                        <label key={t.id} style={styles.tagRow}>
                          <input type="checkbox" checked={checked} onChange={() => toggleTag(b.branchId, t.name)} />
                          <span>{t.name}</span>
                        </label>
                      );
                    })}
                    {(availableTags[b.branchId] || []).length === 0 && !tagsLoading[b.branchId] && (
                      <span style={styles.noTags}>Теги не найдены</span>
                    )}
                    {(availableTags[b.branchId] || []).length > 0 && getVisibleTags(b.branchId).length === 0 && (
                      <span style={styles.noTags}>Ничего не найдено</span>
                    )}
                  </div>

                  <button
                    style={styles.tagsSave}
                    disabled={tagsSaving[b.branchId]}
                    onClick={() => handleSaveTags(b.branchId)}
                  >
                    {tagsSaving[b.branchId] ? 'Сохранение...' : 'Сохранить теги'}
                  </button>
                </div>
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
  tagsBlock: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' },
  tagsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  tagsTitle: { fontSize: '13px', fontWeight: 600, color: '#1a1a2e' },
  tagsReload: {
    border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: '#64748b',
    cursor: 'pointer', fontSize: '14px', width: '28px', height: '28px',
  },
  tagSearch: {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa', marginBottom: '8px',
  },
  tagList: {
    display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflow: 'auto',
    border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px',
  },
  tagRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' },
  noTags: { fontSize: '12px', color: '#94a3b8' },
  tagsSave: {
    padding: '8px', border: 'none', borderRadius: '8px', backgroundColor: '#16a34a',
    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
  },
};

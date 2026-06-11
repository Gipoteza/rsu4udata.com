import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface Tag { id: number; name: string; }

const CITIES = [
  { branchId: 1, name: 'Киев' },
  { branchId: 2, name: 'Одесса' },
  { branchId: 3, name: 'Львов' },
  { branchId: 4, name: 'Варшава' },
];

export default function ForecastPage() {
  const [tagsByBranch, setTagsByBranch] = useState<Record<number, Tag[]>>({});
  const [selected, setSelected] = useState<Record<number, Set<string>>>({});
  const [search, setSearch] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');

  const loadTags = async (branchId: number) => {
    setLoading((p) => ({ ...p, [branchId]: true }));
    try {
      const res = await api.get<Tag[]>(`/integrations/kommo/tags/${branchId}`);
      setTagsByBranch((p) => ({ ...p, [branchId]: res.data }));
    } catch (e: any) {
      setError(`${CITIES.find((c) => c.branchId === branchId)?.name}: не удалось загрузить теги`);
    } finally {
      setLoading((p) => ({ ...p, [branchId]: false }));
    }
  };

  useEffect(() => {
    CITIES.forEach((c) => loadTags(c.branchId));
  }, []);

  const toggle = (branchId: number, name: string) => {
    setSelected((prev) => {
      const set = new Set(prev[branchId] || []);
      if (set.has(name)) set.delete(name); else set.add(name);
      return { ...prev, [branchId]: set };
    });
  };

  const getVisible = (branchId: number) => {
    const all = tagsByBranch[branchId] || [];
    const sel = selected[branchId] || new Set<string>();
    const q = (search[branchId] || '').toLowerCase().trim();
    const filtered = q ? all.filter((t) => t.name.toLowerCase().includes(q)) : all;
    return [...filtered].sort((a, b) => {
      const aSel = sel.has(a.name) ? 0 : 1;
      const bSel = sel.has(b.name) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.name.localeCompare(b.name, 'ru');
    });
  };

  const totalSelected = Object.values(selected).reduce((sum, s) => sum + s.size, 0);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Прогнозирование</h1>
      <p style={styles.subtitle}>
        Выберите теги Kommo по каждому городу — далее построим графики по выбранным тегам.
        {totalSelected > 0 ? ` Выбрано тегов: ${totalSelected}` : ''}
      </p>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {CITIES.map((c) => (
          <div key={c.branchId} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cityName}>{c.name}</span>
              <button
                style={styles.reload}
                onClick={() => loadTags(c.branchId)}
                disabled={loading[c.branchId]}
              >
                {loading[c.branchId] ? '...' : '⟳'}
              </button>
            </div>

            <input
              style={styles.searchInput}
              value={search[c.branchId] || ''}
              onChange={(e) => setSearch((p) => ({ ...p, [c.branchId]: e.target.value }))}
              placeholder="Поиск по тегам..."
            />

            <div style={styles.tagList}>
              {getVisible(c.branchId).map((t) => {
                const checked = selected[c.branchId]?.has(t.name) || false;
                return (
                  <label key={t.id} style={styles.tagRow}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(c.branchId, t.name)} />
                    <span>{t.name}</span>
                  </label>
                );
              })}
              {(tagsByBranch[c.branchId] || []).length === 0 && !loading[c.branchId] && (
                <span style={styles.empty}>Теги не найдены</span>
              )}
            </div>

            <div style={styles.selCount}>
              Выбрано: {selected[c.branchId]?.size || 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 20px 0' },
  error: {
    padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cityName: { fontSize: '17px', fontWeight: 600, color: '#1a1a2e' },
  reload: {
    border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: '#64748b',
    cursor: 'pointer', fontSize: '14px', width: '28px', height: '28px',
  },
  searchInput: {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#1a1a2e', outline: 'none', backgroundColor: '#fafafa',
  },
  tagList: {
    display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '260px', overflow: 'auto',
    border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px',
  },
  tagRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' },
  empty: { fontSize: '12px', color: '#94a3b8' },
  selCount: { fontSize: '12px', color: '#4f46e5', fontWeight: 600 },
};

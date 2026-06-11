import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../api/axios';

interface Tag { id: number; name: string; }
interface Status { id: number; name: string; pipeline: string; }
interface RevenueDaily { branchId: number; labels: string[]; series: number[]; total: number; }

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

  // Воронки (статусы)
  const [statusesByBranch, setStatusesByBranch] = useState<Record<number, Status[]>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<Record<number, Set<string>>>({});
  const [statusSearch, setStatusSearch] = useState<Record<number, string>>({});
  const [statusLoading, setStatusLoading] = useState<Record<number, boolean>>({});

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Данные графиков
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(false);
  const [revByBranch, setRevByBranch] = useState<Record<number, RevenueDaily>>({});

  const handleBuild = async (fromArg?: string, toArg?: string) => {
    const f = fromArg || fromDate;
    const t = toArg || toDate;
    if (!f || !t) {
      setError('Укажите период (от и до)');
      return;
    }
    setBuilding(true);
    setError(''); setNotice('');
    try {
      const results = await Promise.allSettled(
        CITIES.map((c) => {
          const statuses = Array.from(selectedStatuses[c.branchId] || []);
          const tags = Array.from(selected[c.branchId] || []);
          const params = new URLSearchParams({ from: f, to: t });
          if (statuses.length) params.set('statuses', statuses.join('|'));
          if (tags.length) params.set('tags', tags.join('|'));
          return api.get<RevenueDaily>(`/integrations/kommo/forecast-revenue/${c.branchId}?${params.toString()}`);
        })
      );
      const map: Record<number, RevenueDaily> = {};
      const failed: string[] = [];
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          map[r.value.data.branchId] = r.value.data;
        } else {
          failed.push(CITIES[idx].name);
        }
      });
      setRevByBranch(map);
      setBuilt(true);
      if (failed.length > 0) {
        setError(`Не удалось получить данные: ${failed.join(', ')}`);
      }
    } catch (e: any) {
      setError('Не удалось построить графики');
    } finally {
      setBuilding(false);
    }
  };

  const loadSaved = async () => {
    try {
      const res = await api.get<{ branchId: number; tagNames: string[] }[]>('/integrations/kommo/forecast-tag-map');
      const sel: Record<number, Set<string>> = {};
      res.data.forEach((m) => { sel[m.branchId] = new Set(m.tagNames); });
      setSelected(sel);
    } catch { /* пусто */ }
    try {
      const res = await api.get<{ branchId: number; statusNames: string[] }[]>('/integrations/kommo/forecast-status-map');
      const sel: Record<number, Set<string>> = {};
      res.data.forEach((m) => { sel[m.branchId] = new Set(m.statusNames); });
      setSelectedStatuses(sel);
    } catch { /* пусто */ }
  };

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

  const loadStatuses = async (branchId: number) => {
    setStatusLoading((p) => ({ ...p, [branchId]: true }));
    try {
      const res = await api.get<Status[]>(`/integrations/kommo/statuses/${branchId}`);
      setStatusesByBranch((p) => ({ ...p, [branchId]: res.data }));
    } catch (e: any) {
      setError(`${CITIES.find((c) => c.branchId === branchId)?.name}: не удалось загрузить воронки`);
    } finally {
      setStatusLoading((p) => ({ ...p, [branchId]: false }));
    }
  };

  useEffect(() => {
    CITIES.forEach((c) => { loadTags(c.branchId); loadStatuses(c.branchId); });
    loadSaved();
    // Период по умолчанию — последние 30 дней
    const today = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 29);
    const f = past.toISOString().slice(0, 10);
    const t = today.toISOString().slice(0, 10);
    setFromDate(f);
    setToDate(t);
    // Автопостроение графиков по сохранённым тегам/воронкам
    handleBuild(f, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(''); setNotice('');
    try {
      await Promise.all([
        ...CITIES.map((c) =>
          api.post(`/integrations/kommo/forecast-tag-map/${c.branchId}`, {
            tagNames: Array.from(selected[c.branchId] || []),
          })
        ),
        ...CITIES.map((c) =>
          api.post(`/integrations/kommo/forecast-status-map/${c.branchId}`, {
            statusNames: Array.from(selectedStatuses[c.branchId] || []),
          })
        ),
      ]);
      setNotice('Выбранные теги и воронки сохранены');
    } catch (e: any) {
      setError('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (branchId: number, name: string) => {
    setSelected((prev) => {
      const set = new Set(prev[branchId] || []);
      if (set.has(name)) set.delete(name); else set.add(name);
      return { ...prev, [branchId]: set };
    });
  };

  const toggleStatus = (branchId: number, name: string) => {
    setSelectedStatuses((prev) => {
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

  const getVisibleStatuses = (branchId: number) => {
    const all = statusesByBranch[branchId] || [];
    const sel = selectedStatuses[branchId] || new Set<string>();
    const q = (statusSearch[branchId] || '').toLowerCase().trim();
    const filtered = q ? all.filter((s) => s.name.toLowerCase().includes(q)) : all;
    return [...filtered].sort((a, b) => {
      const aSel = sel.has(a.name) ? 0 : 1;
      const bSel = sel.has(b.name) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.name.localeCompare(b.name, 'ru');
    });
  };

  const totalSelected = Object.values(selected).reduce((sum, s) => sum + s.size, 0);
  const totalStatuses = Object.values(selectedStatuses).reduce((sum, s) => sum + s.size, 0);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Прогнозирование</h1>
      <p style={styles.subtitle}>
        Выберите теги и воронки Kommo по каждому городу — далее построим графики.
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {notice && <div style={styles.notice}>{notice}</div>}

      {/* Период и сохранение */}
      <div style={styles.controlBar}>
        <div style={styles.periodGroup}>
          <span style={styles.periodLabel}>Период:</span>
          <input type="date" style={styles.dateInput} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span style={styles.dash}>—</span>
          <input type="date" style={styles.dateInput} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить теги и воронки'}
        </button>
        <button style={styles.buildBtn} onClick={() => handleBuild()} disabled={building}>
          {building ? 'Строим...' : 'Построить графики'}
        </button>
      </div>

      {/* Индикатор построения */}
      {building && (
        <div style={styles.chartBox}>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8892a4' }}>
            Строим графики... (загрузка данных из Kommo может занять до минуты)
          </div>
        </div>
      )}

      {/* Графики дохода */}
      {building && <div style={styles.chartLoading}>Строим графики из Kommo, это может занять до минуты...</div>}

      {!building && Object.keys(revByBranch).length > 0 && (() => {
        const fmt = (labels: string[]) => labels.map((d) => { const [, m, day] = d.split('-'); return `${day}.${m}`; });
        const kyiv = revByBranch[1];
        const odesa = revByBranch[2];
        const lviv = revByBranch[3];
        const warsaw = revByBranch[4];
        const labels1 = fmt((kyiv || odesa || lviv)?.labels || []);
        const totalSeries = (kyiv?.labels || []).map((_, i) =>
          Number(((kyiv?.series[i] || 0) + (odesa?.series[i] || 0) + (lviv?.series[i] || 0)).toFixed(2))
        );
        const grand = (kyiv?.total || 0) + (odesa?.total || 0) + (lviv?.total || 0);

        const chart1Series = [
          { name: 'Киев', type: 'column', data: kyiv?.series || [] },
          { name: 'Одесса', type: 'column', data: odesa?.series || [] },
          { name: 'Львов', type: 'column', data: lviv?.series || [] },
          { name: 'Всего', type: 'line', data: totalSeries },
        ];
        const chart1Options: ApexOptions = {
          chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit' },
          stroke: { width: [0, 0, 0, 3], curve: 'smooth' },
          plotOptions: { bar: { columnWidth: '60%', borderRadius: 3 } },
          colors: ['#4f46e5', '#16a34a', '#ea580c', '#1a1a2e'],
          dataLabels: { enabled: false },
          labels: labels1,
          xaxis: { type: 'category' },
          yaxis: { title: { text: 'Доход, €' }, labels: { formatter: (v) => `${Math.round(v)} €` } },
          tooltip: { shared: true, intersect: false, y: { formatter: (v) => `${v} €` } },
          legend: { position: 'top' },
        };

        const labels2 = fmt(warsaw?.labels || []);
        const chart2Series = [{ name: 'Варшава', type: 'column', data: warsaw?.series || [] }];
        const chart2Options: ApexOptions = {
          chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
          plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
          colors: ['#1877f2'],
          dataLabels: { enabled: false },
          labels: labels2,
          xaxis: { type: 'category' },
          yaxis: { title: { text: 'Доход, zł' }, labels: { formatter: (v) => `${Math.round(v)} zł` } },
          tooltip: { y: { formatter: (v) => `${v} zł` } },
          legend: { position: 'top' },
        };

        return (
          <div style={styles.charts}>
            <div style={styles.chartBox}>
              <div style={styles.chartTitle}>
                Доход: Киев + Одесса + Львов (€) · всего {grand.toFixed(2)} €
              </div>
              <ReactApexChart options={chart1Options} series={chart1Series} type="line" height={360} />
            </div>
            <div style={styles.chartBox}>
              <div style={styles.chartTitle}>
                Доход: Варшава (zł) · всего {(warsaw?.total || 0).toFixed(2)} zł
              </div>
              <ReactApexChart options={chart2Options} series={chart2Series} type="bar" height={360} />
            </div>
          </div>
        );
      })()}

      <h2 style={styles.sectionTitle}>Теги{totalSelected > 0 ? ` · выбрано ${totalSelected}` : ''}</h2>
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

      <h2 style={styles.sectionTitle}>Воронки{totalStatuses > 0 ? ` · выбрано ${totalStatuses}` : ''}</h2>
      <div style={styles.grid}>
        {CITIES.map((c) => (
          <div key={c.branchId} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cityName}>{c.name}</span>
              <button
                style={styles.reload}
                onClick={() => loadStatuses(c.branchId)}
                disabled={statusLoading[c.branchId]}
              >
                {statusLoading[c.branchId] ? '...' : '⟳'}
              </button>
            </div>

            <input
              style={styles.searchInput}
              value={statusSearch[c.branchId] || ''}
              onChange={(e) => setStatusSearch((p) => ({ ...p, [c.branchId]: e.target.value }))}
              placeholder="Поиск по воронкам..."
            />

            <div style={styles.tagList}>
              {getVisibleStatuses(c.branchId).map((s) => {
                const checked = selectedStatuses[c.branchId]?.has(s.name) || false;
                return (
                  <label key={s.id} style={styles.tagRow}>
                    <input type="checkbox" checked={checked} onChange={() => toggleStatus(c.branchId, s.name)} />
                    <span>{s.name}<span style={styles.pipeline}>{s.pipeline}</span></span>
                  </label>
                );
              })}
              {(statusesByBranch[c.branchId] || []).length === 0 && !statusLoading[c.branchId] && (
                <span style={styles.empty}>Воронки не найдены</span>
              )}
            </div>

            <div style={styles.selCount}>
              Выбрано: {selectedStatuses[c.branchId]?.size || 0}
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
  notice: {
    padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '8px', color: '#15803d', fontSize: '14px', marginBottom: '16px',
  },
  controlBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '14px 20px', marginBottom: '20px', flexWrap: 'wrap',
  },
  periodGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  periodLabel: { fontSize: '14px', color: '#64748b', fontWeight: 500 },
  dateInput: {
    border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 10px', fontSize: '13px',
    color: '#1a1a2e', outline: 'none', background: '#fafafa',
  },
  dash: { color: '#94a3b8' },
  saveBtn: {
    border: 'none', borderRadius: '8px', padding: '10px 18px', background: '#4f46e5', color: '#fff',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  buildBtn: {
    border: 'none', borderRadius: '8px', padding: '10px 18px', background: '#16a34a', color: '#fff',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  charts: { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' },
  chartBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' },
  chartTitle: { fontSize: '15px', fontWeight: 600, color: '#1a1a2e', marginBottom: '12px' },
  chartLoading: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '40px', textAlign: 'center', color: '#8892a4', fontSize: '14px', marginBottom: '20px',
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
  sectionTitle: { fontSize: '18px', fontWeight: 700, color: '#1a1a2e', margin: '8px 0 14px 0' },
  pipeline: { display: 'block', fontSize: '11px', color: '#94a3b8' },
};

import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../api/axios';

interface LeadsDaily { labels: string[]; series: number[]; total: number; }
interface SpendDaily { labels: string[]; series: number[]; total: number; note?: string; }
interface AdsetRow { adsetName: string; spend: number; leads: number; costPerLead: number | null; }

const RANGES = [7, 14, 30, 90];
const RANGE_LABEL: Record<number, string> = {
  7: 'Last 7 days', 14: 'Last 14 days', 30: 'Last 30 days', 90: 'Last 90 days',
};

export default function CityBlock({ branchId, cityName }: { branchId: number; cityName: string }) {
  const [leads, setLeads] = useState<LeadsDaily | null>(null);
  const [spend, setSpend] = useState<SpendDaily | null>(null);
  const [adsets, setAdsets] = useState<AdsetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeIdx, setRangeIdx] = useState(0); // 7 days
  const [granularity, setGranularity] = useState('Daily');
  const [customMode, setCustomMode] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const days = RANGES[rangeIdx];

  const load = async () => {
    setLoading(true);
    setError('');
    // Параметры периода: либо custom from/to, либо days
    const useCustom = customMode && fromDate && toDate;
    const q = useCustom ? `from=${fromDate}&to=${toDate}` : `days=${days}`;
    try {
      const [leadsRes, spendRes, adsetsRes] = await Promise.allSettled([
        api.get<LeadsDaily>(`/integrations/kommo/leads-daily/${branchId}?${q}`),
        api.get<SpendDaily>(`/integrations/facebook/city-spend/${branchId}?${q}`),
        api.get<{ rows: AdsetRow[] }>(`/integrations/facebook/city-adsets/${branchId}?${q}`),
      ]);
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data);
      else setError('Не удалось загрузить лиды из Kommo');
      if (spendRes.status === 'fulfilled') setSpend(spendRes.value.data);
      if (adsetsRes.status === 'fulfilled') setAdsets(adsetsRes.value.data.rows || []);
    } catch {
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIdx]);

  const rawLabels = leads?.labels || spend?.labels || [];
  const chartLabels = rawLabels.map((d) => {
    const [, m, day] = d.split('-');
    return `${day}.${m}`;
  });

  const series = [
    { name: 'Лиды', type: 'column', data: leads?.series || [] },
    { name: 'Затраты Facebook, zł', type: 'line', data: spend?.series || [] },
  ];

  const options: ApexOptions = {
    chart: { height: 380, type: 'line', toolbar: { show: false }, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    stroke: { width: [0, 3], curve: 'smooth' },
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
    colors: ['#4f46e5', '#16a34a'],
    dataLabels: { enabled: false },
    labels: chartLabels,
    xaxis: { type: 'category' },
    yaxis: [
      { title: { text: 'Лиды' }, labels: { formatter: (v) => `${Math.round(v)}` } },
      { opposite: true, title: { text: 'Затраты, zł' }, labels: { formatter: (v) => `${Math.round(v)} zł` } },
    ],
    tooltip: { shared: true, intersect: false },
    legend: { position: 'top' },
  };

  const canPrev = rangeIdx < RANGES.length - 1;
  const canNext = rangeIdx > 0;
  const maxSpend = Math.max(...adsets.map((a) => a.spend), 1);

  // KPI
  const totalLeads = leads?.total ?? 0;
  const totalSpend = spend?.total ?? 0;
  const costPerLead = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '—';

  return (
    <div style={styles.block}>
      <div style={styles.toolbar}>
        <div style={styles.pill}>
          <span style={styles.cityName}>{cityName}</span>
        </div>
        {!customMode ? (
          <div style={styles.rangeGroup}>
            <button style={{ ...styles.arrow, opacity: canPrev ? 1 : 0.35, cursor: canPrev ? 'pointer' : 'default' }} onClick={() => canPrev && setRangeIdx((i) => i + 1)}>‹</button>
            <span style={styles.rangeLabel}>{RANGE_LABEL[days]}</span>
            <button style={{ ...styles.arrow, opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'default' }} onClick={() => canNext && setRangeIdx((i) => i - 1)}>›</button>
          </div>
        ) : (
          <div style={styles.customGroup}>
            <input type="date" style={styles.dateInput} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span style={styles.dash}>—</span>
            <input type="date" style={styles.dateInput} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <button style={styles.applyBtn} onClick={load} disabled={!fromDate || !toDate}>OK</button>
          </div>
        )}

        <button
          style={{ ...styles.modeBtn, color: customMode ? '#4f46e5' : '#64748b' }}
          onClick={() => setCustomMode((v) => !v)}
          title={customMode ? 'Готовые периоды' : 'Свой диапазон'}
        >
          {customMode ? 'Периоды' : 'Календарь'}
        </button>

        <div style={styles.dailyPill}>
          <select style={styles.select} value={granularity} onChange={(e) => setGranularity(e.target.value)}>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
          </select>
        </div>
        <button style={styles.refresh} onClick={load} title="Обновить" disabled={loading}>⟳</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {spend?.note && <div style={styles.note}>Facebook: {spend.note}</div>}

      {/* Единый блок: KPI сверху + график снизу */}
      <div style={styles.cardWrap}>
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Лиды</div>
            <div style={styles.kpiValue}>{totalLeads}</div>
          </div>
          <div style={styles.kpiDivider} />
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Затраты</div>
            <div style={styles.kpiValue}>{totalSpend} zł</div>
          </div>
          <div style={styles.kpiDivider} />
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Цена лида</div>
            <div style={styles.kpiValue}>{costPerLead === '—' ? '—' : `${costPerLead} zł`}</div>
          </div>
        </div>

        <div style={styles.chartArea}>
          {loading ? (
            <div style={styles.loading}>Загрузка данных...</div>
          ) : (
            <ReactApexChart options={options} series={series} type="line" height={380} />
          )}
        </div>
      </div>

      <div style={styles.tableBox}>
        <div style={styles.tableTitle}>Группы объявлений · стоимость лида</div>
        {adsets.length === 0 ? (
          <div style={styles.tableEmpty}>Нет данных по группам (привяжите кампании на странице Facebook).</div>
        ) : (
          <div style={styles.tableHeaderRow}>
            <span style={styles.thName}>Группа</span>
            <span style={styles.thNum}>Лиды</span>
            <span style={styles.thNum}>Расход</span>
            <span style={styles.thNum}>Цена лида</span>
          </div>
        )}
        {adsets.map((row, i) => {
          const barPct = Math.round((row.spend / maxSpend) * 100);
          return (
            <div key={i} style={styles.tableRow}>
              <div style={styles.nameCell}>
                <div style={{ ...styles.bar, width: `${barPct}%` }} />
                <span style={styles.nameText}>{row.adsetName}</span>
              </div>
              <span style={styles.numCell}>{row.leads}</span>
              <span style={styles.numCell}>{row.spend} zł</span>
              <span style={styles.cplCell}>{row.costPerLead != null ? `${row.costPerLead} zł` : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  block: { marginBottom: '40px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  pill: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cityName: { fontSize: '14px', fontWeight: 600, color: '#1a1a2e' },
  rangeGroup: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  arrow: { border: 'none', background: 'none', fontSize: '20px', color: '#64748b', width: '28px', height: '28px', lineHeight: 1, borderRadius: '6px' },
  rangeLabel: { fontSize: '14px', color: '#1a1a2e', fontWeight: 500, padding: '0 8px', minWidth: '92px', textAlign: 'center' },
  customGroup: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  dateInput: {
    border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', fontSize: '13px',
    color: '#1a1a2e', outline: 'none', background: '#fafafa',
  },
  dash: { color: '#94a3b8' },
  applyBtn: {
    border: 'none', borderRadius: '8px', padding: '7px 12px', background: '#4f46e5', color: '#fff',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  modeBtn: {
    border: '1px solid #e2e8f0', borderRadius: '10px', padding: '9px 14px', background: '#fff',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  dailyPill: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' },
  select: {
    border: 'none', background: 'transparent', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23475569\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
    padding: '9px 38px 9px 14px', fontSize: '14px', color: '#1a1a2e', fontWeight: 500, outline: 'none', cursor: 'pointer',
  },
  refresh: { width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  chartBox: { background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', minHeight: '420px' },
  cardWrap: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
  },
  kpiRow: {
    display: 'flex', alignItems: 'center', padding: '16px 24px',
    gap: '24px', borderBottom: '1px solid #f1f5f9',
  },
  chartArea: { padding: '16px 20px 20px 20px', minHeight: '400px' },
  kpiCard: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' },
  kpiLabel: { fontSize: '13px', color: '#8892a4', fontWeight: 500 },
  kpiValue: { fontSize: '26px', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.1 },
  kpiDivider: { width: '1px', alignSelf: 'stretch', background: '#f1f5f9' },
  loading: { padding: '160px 0', textAlign: 'center', color: '#8892a4' },
  error: { padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px' },
  note: { padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px', marginBottom: '16px' },
  tableBox: { marginTop: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', maxWidth: '620px' },
  tableTitle: { fontSize: '15px', fontWeight: 600, color: '#1a1a2e', marginBottom: '12px' },
  tableEmpty: { fontSize: '13px', color: '#94a3b8', padding: '8px 0' },
  tableHeaderRow: { display: 'grid', gridTemplateColumns: '1fr 70px 90px 100px', gap: '8px', padding: '0 0 8px 0', borderBottom: '1px solid #f1f5f9' },
  thName: { fontSize: '12px', color: '#94a3b8', fontWeight: 600 },
  thNum: { fontSize: '12px', color: '#94a3b8', fontWeight: 600, textAlign: 'right' },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr 70px 90px 100px', gap: '8px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' },
  nameCell: { position: 'relative', display: 'flex', alignItems: 'center', minHeight: '28px', borderRadius: '6px', overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#eef2ff', borderRadius: '6px' },
  nameText: { position: 'relative', fontSize: '13px', color: '#1a1a2e', padding: '0 8px', zIndex: 1 },
  numCell: { fontSize: '13px', color: '#334155', textAlign: 'right' },
  cplCell: { fontSize: '13px', color: '#4f46e5', fontWeight: 600, textAlign: 'right' },
};

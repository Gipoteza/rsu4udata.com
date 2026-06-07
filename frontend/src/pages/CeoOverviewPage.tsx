import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../api/axios';

interface LeadsDaily {
  labels: string[];
  series: number[];
  total: number;
}
interface SpendDaily {
  labels: string[];
  series: number[];
  total: number;
  note?: string;
}

const ODESA_BRANCH_ID = 2;

// Доступные периоды (переключаются стрелками)
const RANGES = [7, 14, 30, 90];
const RANGE_LABEL: Record<number, string> = {
  7: 'Last 7 days',
  14: 'Last 14 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
};

export default function CeoOverviewPage() {
  const [leads, setLeads] = useState<LeadsDaily | null>(null);
  const [spend, setSpend] = useState<SpendDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeIdx, setRangeIdx] = useState(2); // 30 days по умолчанию
  const [granularity, setGranularity] = useState('Daily');

  const days = RANGES[rangeIdx];

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, spendRes] = await Promise.allSettled([
        api.get<LeadsDaily>(`/integrations/kommo/leads-daily/${ODESA_BRANCH_ID}?days=${days}`),
        api.get<SpendDaily>(`/integrations/facebook/city-spend/${ODESA_BRANCH_ID}?days=${days}`),
      ]);
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data);
      else setError('Не удалось загрузить лиды из Kommo');
      if (spendRes.status === 'fulfilled') setSpend(spendRes.value.data);
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
    chart: {
      height: 380,
      type: 'line',
      toolbar: { show: false },
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
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

  const canPrev = rangeIdx < RANGES.length - 1; // больше дней
  const canNext = rangeIdx > 0; // меньше дней

  return (
    <div style={styles.page}>
      {/* Тулбар как в примере */}
      <div style={styles.toolbar}>
        <div style={styles.pill}>
          <span style={styles.cityName}>Одесса</span>
        </div>

        <div style={styles.rangeGroup}>
          <button
            style={{ ...styles.arrow, opacity: canPrev ? 1 : 0.35, cursor: canPrev ? 'pointer' : 'default' }}
            onClick={() => canPrev && setRangeIdx((i) => i + 1)}
          >
            ‹
          </button>
          <span style={styles.rangeLabel}>{RANGE_LABEL[days]}</span>
          <button
            style={{ ...styles.arrow, opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'default' }}
            onClick={() => canNext && setRangeIdx((i) => i - 1)}
          >
            ›
          </button>
        </div>

        <div style={styles.dailyPill}>
          <select
            style={styles.select}
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
          </select>
        </div>

        <button style={styles.refresh} onClick={load} title="Обновить" disabled={loading}>
          ⟳
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {spend?.note && <div style={styles.note}>Facebook: {spend.note}</div>}

      <div style={styles.chartBox}>
        {loading ? (
          <div style={styles.loading}>Загрузка данных...</div>
        ) : (
          <ReactApexChart options={options} series={series} type="line" height={380} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  pill: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cityIcon: { fontSize: '15px' },
  cityName: { fontSize: '14px', fontWeight: 600, color: '#1a1a2e' },
  rangeGroup: {
    display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  arrow: {
    border: 'none', background: 'none', fontSize: '20px', color: '#64748b',
    width: '28px', height: '28px', lineHeight: 1, borderRadius: '6px',
  },
  rangeLabel: { fontSize: '14px', color: '#1a1a2e', fontWeight: 500, padding: '0 8px', minWidth: '92px', textAlign: 'center' },
  dailyPill: {
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
  },
  select: {
    border: 'none', background: 'transparent', padding: '9px 32px 9px 14px', fontSize: '14px',
    color: '#1a1a2e', fontWeight: 500, outline: 'none', cursor: 'pointer',
  },
  refresh: {
    width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0',
    background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '18px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  chartBox: { background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', minHeight: '420px' },
  loading: { padding: '160px 0', textAlign: 'center', color: '#8892a4' },
  error: {
    padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px',
  },
  note: {
    padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: '8px', color: '#92400e', fontSize: '13px', marginBottom: '16px',
  },
};

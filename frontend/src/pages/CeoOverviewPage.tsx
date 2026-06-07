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

export default function CeoOverviewPage() {
  const [leads, setLeads] = useState<LeadsDaily | null>(null);
  const [spend, setSpend] = useState<SpendDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // Параллельно тянем лиды (Kommo) и затраты (Facebook)
      const [leadsRes, spendRes] = await Promise.allSettled([
        api.get<LeadsDaily>(`/integrations/kommo/leads-daily/${ODESA_BRANCH_ID}?days=14&tag=РЕКЛАМА`),
        api.get<SpendDaily>(`/integrations/facebook/city-spend/${ODESA_BRANCH_ID}?days=14`),
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
  }, []);

  // Метки берём из лидов (или из затрат) и форматируем DD.MM
  const rawLabels = leads?.labels || spend?.labels || [];
  const chartLabels = rawLabels.map((d) => {
    const [, m, day] = d.split('-');
    return `${day}.${m}`;
  });

  const series = [
    {
      name: 'Лиды (РЕКЛАМА)',
      type: 'column',
      data: leads?.series || [],
    },
    {
      name: 'Затраты Facebook, €',
      type: 'line',
      data: spend?.series || [],
    },
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
      {
        title: { text: 'Лиды' },
        labels: { formatter: (v) => `${Math.round(v)}` },
      },
      {
        opposite: true,
        title: { text: 'Затраты, €' },
        labels: { formatter: (v) => `${Math.round(v)} €` },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
    },
    legend: { position: 'top' },
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Одесса</h1>
      <p style={styles.subtitle}>
        Лиды с тегом «РЕКЛАМА» и затраты Facebook за 14 дней
        {leads ? ` · лидов ${leads.total}` : ''}
        {spend && typeof spend.total === 'number' ? ` · затраты ${spend.total} €` : ''}
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {spend?.note && <div style={styles.note}>Facebook: {spend.note}</div>}

      <div style={styles.chartBox}>
        {loading ? (
          <div style={styles.loading}>Загрузка данных...</div>
        ) : (
          <ReactApexChart options={options} series={series} type="line" height={380} />
        )}
      </div>

      <button style={styles.reload} onClick={load} disabled={loading}>
        Обновить
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 20px 0' },
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
  reload: {
    marginTop: '16px', padding: '9px 16px', border: '1px solid #4f46e5', borderRadius: '8px',
    background: '#fff', color: '#4f46e5', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
};

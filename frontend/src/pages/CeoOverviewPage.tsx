import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../api/axios';

interface LeadsDaily {
  tag: string;
  days: number;
  labels: string[]; // YYYY-MM-DD от старого к сегодня
  series: number[];
  total: number;
}

const ODESA_BRANCH_ID = 2;

export default function CeoOverviewPage() {
  const [data, setData] = useState<LeadsDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<LeadsDaily>(
        `/integrations/kommo/leads-daily/${ODESA_BRANCH_ID}?days=14&tag=РЕКЛАМА`
      );
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Не удалось загрузить данные из Kommo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Метки в формат DD.MM, и разворачиваем чтобы сегодня было справа (от старого к новому уже так)
  const chartLabels = (data?.labels || []).map((d) => {
    const [, m, day] = d.split('-');
    return `${day}.${m}`;
  });

  const series = [
    {
      name: 'Лиды (РЕКЛАМА)',
      type: 'column',
      data: data?.series || [],
    },
  ];

  const options: ApexOptions = {
    chart: {
      height: 350,
      type: 'bar',
      toolbar: { show: false },
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
    dataLabels: { enabled: true },
    colors: ['#4f46e5'],
    stroke: { width: 0 },
    labels: chartLabels,
    xaxis: { type: 'category' },
    yaxis: { title: { text: 'Количество лидов' }, labels: { formatter: (v) => `${Math.round(v)}` } },
    tooltip: { y: { formatter: (v) => `${Math.round(v)} лидов` } },
    legend: { position: 'top' },
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Одесса</h1>
      <p style={styles.subtitle}>
        Лиды с тегом «РЕКЛАМА» за 14 дней
        {data ? ` · всего ${data.total}` : ''}
      </p>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.chartBox}>
        {loading ? (
          <div style={styles.loading}>Загрузка данных из Kommo...</div>
        ) : (
          <ReactApexChart options={options} series={series} type="bar" height={350} />
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
  chartBox: { background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', minHeight: '380px' },
  loading: { padding: '140px 0', textAlign: 'center', color: '#8892a4' },
  error: {
    padding: '12px 16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: '8px', color: '#e53e3e', fontSize: '14px', marginBottom: '16px',
  },
  reload: {
    marginTop: '16px', padding: '9px 16px', border: '1px solid #4f46e5', borderRadius: '8px',
    background: '#fff', color: '#4f46e5', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
};

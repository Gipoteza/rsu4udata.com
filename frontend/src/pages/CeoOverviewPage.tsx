import React from 'react';
import MixedChart from '../components/MixedChart';

export default function CeoOverviewPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Одесса</h1>
      <p style={styles.subtitle}>Revenue vs Spend</p>
      <MixedChart />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#8892a4', margin: '0 0 20px 0' },
};

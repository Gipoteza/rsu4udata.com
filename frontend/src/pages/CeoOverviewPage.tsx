import React from 'react';
import CityBlock from '../components/CityBlock';

// Branch IDs: 1=Киев, 2=Одесса, 3=Львов, 4=Варшава
export default function CeoOverviewPage() {
  return (
    <div style={styles.page}>
      <CityBlock branchId={2} cityName="Одесса" />
      <CityBlock branchId={1} cityName="Киев" />
      <CityBlock branchId={4} cityName="Варшава" />
      <CityBlock branchId={3} cityName="Львов" />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
};

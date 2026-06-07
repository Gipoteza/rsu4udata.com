import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { path: '/dashboard', label: 'CEO Overview' },
  { path: '/dashboard/integrations', label: 'Интеграции' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <div style={styles.wrap}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>RSU4U</div>
        <nav style={styles.nav}>
          {NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.navLink,
                  backgroundColor: active ? '#eef2ff' : 'transparent',
                  color: active ? '#4f46e5' : '#475569',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button style={styles.logout} onClick={() => logout()}>Выйти</button>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  sidebar: {
    width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column', padding: '20px 12px',
  },
  logo: { fontSize: '20px', fontWeight: 700, color: '#1a1a2e', letterSpacing: '2px', padding: '8px 12px 24px 12px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navLink: { padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px' },
  logout: {
    padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
    background: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer',
  },
  main: { flex: 1, overflow: 'auto' },
};

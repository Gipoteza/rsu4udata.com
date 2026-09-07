import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие меню по клику вне его
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.topbar} ref={menuRef}>
        <button style={styles.settingsBtn} onClick={() => navigate('/dashboard')} title="Главная">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        <button style={styles.settingsBtn} onClick={() => navigate('/dashboard/forecast')} title="Прогнозирование">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </button>

        <button style={styles.settingsBtn} onClick={() => setOpen((v) => !v)} title="Настройки">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {open && (
          <div style={styles.menu}>
            <div style={styles.menuSection}>Интеграции</div>
            <button style={styles.menuItem} onClick={() => go('/dashboard/integrations')}>🔌 Kommo CRM</button>
            <button style={styles.menuItem} onClick={() => go('/dashboard/facebook')}>📘 Facebook Ads</button>

            <div style={styles.menuSection}>Клієнти</div>
            <button style={styles.menuItem} onClick={() => go('/dashboard/import-clients')}>📥 Імпорт клієнтів</button>

            <div style={styles.divider} />
            <button style={{ ...styles.menuItem, color: '#e53e3e' }} onClick={() => logout()}>🚪 Выйти</button>
          </div>
        )}
      </div>

      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  topbar: { position: 'relative', padding: '16px 0 0 24px', display: 'flex', gap: '10px' },
  settingsBtn: {
    width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0',
    background: '#fff', color: '#475569', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  menu: {
    position: 'absolute', top: '62px', left: '24px', width: '240px', background: '#fff',
    borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    padding: '8px', zIndex: 50,
  },
  menuSection: {
    fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
    padding: '8px 12px 4px 12px', letterSpacing: '0.5px',
  },
  menuItem: {
    display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
    border: 'none', background: 'none', borderRadius: '8px', fontSize: '14px',
    color: '#334155', cursor: 'pointer',
  },
  divider: { height: '1px', background: '#e2e8f0', margin: '8px 4px' },
  main: { padding: '0' },
};

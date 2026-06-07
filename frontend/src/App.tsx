import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* basename не нужен — nginx раздаёт всё с корня */}
        <BrowserRouter>
          <Routes>
            {/* rsu4udata.com/admin/ — форма входа */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/admin" element={<LoginPage />} />
            <Route path="/admin/" element={<LoginPage />} />
            {/* Защищённые страницы */}
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute>
                  <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
                    <h1>Dashboard — coming soon</h1>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

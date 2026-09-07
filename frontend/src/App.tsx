import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import IntegrationsPage from './pages/IntegrationsPage';
import FacebookPage from './pages/FacebookPage';
import CeoOverviewPage from './pages/CeoOverviewPage';
import ForecastPage from './pages/ForecastPage';
import ImportClientsPage from './pages/ImportClientsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Форма входа на корне */}
            <Route path="/" element={<LoginPage />} />

            {/* Защищённые страницы дашборда */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout><CeoOverviewPage /></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/integrations"
              element={
                <ProtectedRoute>
                  <DashboardLayout><IntegrationsPage /></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/facebook"
              element={
                <ProtectedRoute>
                  <DashboardLayout><FacebookPage /></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/forecast"
              element={
                <ProtectedRoute>
                  <DashboardLayout><ForecastPage /></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/import-clients"
              element={
                <ProtectedRoute>
                  <DashboardLayout><ImportClientsPage /></DashboardLayout>
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

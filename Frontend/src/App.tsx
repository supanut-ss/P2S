import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import type { PaletteMode } from '@mui/material/styles';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createAppTheme } from './theme/theme';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RoleRoute } from './auth/RoleRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReimbursementsPage } from './pages/ReimbursementsPage';
import { ScanPage } from './pages/ScanPage';
import { InventoryPage } from './pages/InventoryPage';
import { CancellationsPage } from './pages/CancellationsPage';
import { AdminPage } from './pages/AdminPage';

const COLOR_MODE_STORAGE_KEY = 'arbify-color-mode';

function getInitialMode(): PaletteMode {
  let mode: PaletteMode = 'light';
  try {
    mode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    mode = 'light';
  }
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.classList.toggle('light', mode === 'light');
  return mode;
}

export default function App() {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      // Keep the selected mode for this session when storage is unavailable.
    }
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.classList.toggle('light', mode === 'light');
  }, [mode]);

  const toggleMode = () => setMode((current) => current === 'light' ? 'dark' : 'light');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage mode={mode} onToggleMode={toggleMode} />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout mode={mode} onToggleMode={toggleMode} />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/orders" element={<RoleRoute><OrdersPage /></RoleRoute>} />
              <Route path="/reimbursements" element={<ReimbursementsPage />} />
              <Route path="/scan" element={<RoleRoute><ScanPage /></RoleRoute>} />
              <Route path="/inventory" element={<RoleRoute><InventoryPage /></RoleRoute>} />
              <Route path="/cancellations" element={<RoleRoute><CancellationsPage /></RoleRoute>} />
              <Route path="/admin" element={<RoleRoute><AdminPage /></RoleRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

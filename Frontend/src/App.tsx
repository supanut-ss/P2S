import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { theme } from './theme/theme';
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

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
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

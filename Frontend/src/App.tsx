import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { theme } from './theme/theme';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

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
              <Route
                path="/orders"
                element={<PlaceholderPage title="Order list" subtitle="filter platform/user/status, ค้นหาเลขออเดอร์" />}
              />
              <Route
                path="/reimbursements"
                element={<PlaceholderPage title="Reimbursement queue" subtitle="ฝ่ายการเงินอนุมัติ/จ่ายเป็นชุด" />}
              />
              <Route
                path="/scan"
                element={<PlaceholderPage title="สแกนรับของ" subtitle="สแกนบาร์โค้ด/tracking แล้ว confirm รับของ" />}
              />
              <Route
                path="/inventory"
                element={<PlaceholderPage title="Inventory list" subtitle="รายการของในคลัง พร้อมปุ่มเบิกออก" />}
              />
              <Route
                path="/cancellations"
                element={<PlaceholderPage title="Cancellation report" subtitle="รายการรอ action ฝ่ายการเงิน" />}
              />
              <Route
                path="/admin"
                element={<PlaceholderPage title="Master data" subtitle="จัดการ users, platforms, withdrawal reasons" />}
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

import { useState } from 'react';
import {
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PaymentsIcon from '@mui/icons-material/Payments';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CancelIcon from '@mui/icons-material/Cancel';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canAccessRoute } from '../auth/roleAccess';
import { tokens } from '../theme/tokens';

const DRAWER_WIDTH = 240;
const TABLET_RAIL_WIDTH = 88;

const navItems = [
  { to: '/', label: 'ภาพรวม', icon: <DashboardIcon /> },
  { to: '/orders', label: 'ออเดอร์', icon: <ListAltIcon /> },
  { to: '/reimbursements', label: 'เบิกเงิน', icon: <PaymentsIcon /> },
  { to: '/scan', label: 'รับของ', icon: <QrCodeScannerIcon /> },
  { to: '/inventory', label: 'คลังสินค้า', icon: <Inventory2Icon /> },
  { to: '/cancellations', label: 'ยกเลิก', icon: <CancelIcon /> },
  { to: '/admin', label: 'ข้อมูลหลัก', icon: <AdminPanelSettingsIcon /> },
];

export function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleNavItems = navItems.filter((item) => canAccessRoute(user?.role, item.to));
  const primaryItems = visibleNavItems.slice(0, 4);
  const activeMobileItem = primaryItems.find((item) => item.to === location.pathname)?.to ?? 'more';

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <List sx={{ pt: 1 }}>
      {visibleNavItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={NavLink}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setMobileOpen(false)}
          aria-label={isTablet ? item.label : undefined}
          sx={{
            mx: 1,
            minHeight: 48,
            borderRadius: `${tokens.radius.md}px`,
            ...(isTablet && { flexDirection: 'column', px: 0.5, py: 1, textAlign: 'center', gap: 0.25 }),
            '&.active': {
              backgroundColor: tokens.color.primary,
              color: tokens.color.primaryForeground,
              '& .MuiListItemIcon-root': { color: tokens.color.primaryForeground },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: isTablet ? 0 : 40, justifyContent: 'center' }}>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} sx={isTablet ? { m: 0, '& .MuiTypography-root': { fontSize: 12, lineHeight: 1.2, overflowWrap: 'anywhere' } } : undefined} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ pt: { xs: 'env(safe-area-inset-top)', md: 0 }, minHeight: { xs: 60, md: 64 } }}>
          {isMobile && <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนูทั้งหมด" sx={{ mr: 1, minWidth: 48, minHeight: 48 }}><MenuIcon /></IconButton>}
          <Box
            component="img"
            src="/logo.jpg"
            alt="Arbify"
            sx={{ width: 44, height: 44, objectFit: 'contain', borderRadius: '8px' }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="เมนูบัญชีผู้ใช้" sx={{ minWidth: 48, minHeight: 48 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: tokens.color.primary, color: tokens.color.primaryForeground, fontSize: '1rem' }}>
              {user?.fullName?.charAt(0) ?? '?'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>{user?.fullName} · {user?.role}</MenuItem>
            <MenuItem onClick={handleLogout}>ออกจากระบบ</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <Toolbar sx={{ pt: 'env(safe-area-inset-top)' }} />
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: isTablet ? TABLET_RAIL_WIDTH : DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: isTablet ? TABLET_RAIL_WIDTH : DRAWER_WIDTH, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider', overflowX: 'hidden' },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: { md: `calc(100% - ${TABLET_RAIL_WIDTH}px)`, lg: `calc(100% - ${DRAWER_WIDTH}px)` }, pb: { xs: 'calc(92px + env(safe-area-inset-bottom))', md: 4 } }}>
        <Toolbar sx={{ pt: { xs: 'env(safe-area-inset-top)', md: 0 }, minHeight: { xs: 60, md: 64 } }} />
        <Box sx={{ mx: 'auto', width: '100%', maxWidth: 1440, px: { xs: 2, sm: 3, md: 3, lg: 4 }, pt: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
      {isMobile && (
        <BottomNavigation
          component="nav"
          aria-label="เมนูหลัก"
          value={activeMobileItem}
          showLabels
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 'calc(64px + env(safe-area-inset-bottom))', pb: 'env(safe-area-inset-bottom)', borderTop: 1, borderColor: 'divider', zIndex: theme.zIndex.appBar, bgcolor: 'background.paper', '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.25, minHeight: 56 }, '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem', lineHeight: 1.2, whiteSpace: 'nowrap' } }}
        >
          {primaryItems.map((item) => <BottomNavigationAction key={item.to} value={item.to} label={item.label} icon={item.icon} onClick={() => navigate(item.to)} />)}
          <BottomNavigationAction value="more" label="เพิ่มเติม" icon={<MoreHorizIcon />} onClick={() => setMobileOpen(true)} />
        </BottomNavigation>
      )}
    </Box>
  );
}

import { useState } from 'react';
import {
  AppBar,
  Avatar,
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
  Typography,
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
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { tokens } from '../theme/tokens';

const DRAWER_WIDTH = 240;

const navItems = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/orders', label: 'Order list', icon: <ListAltIcon /> },
  { to: '/reimbursements', label: 'Reimbursement queue', icon: <PaymentsIcon /> },
  { to: '/scan', label: 'สแกนรับของ', icon: <QrCodeScannerIcon /> },
  { to: '/inventory', label: 'Inventory list', icon: <Inventory2Icon /> },
  { to: '/cancellations', label: 'Cancellation report', icon: <CancelIcon /> },
  { to: '/admin', label: 'Master data', icon: <AdminPanelSettingsIcon /> },
];

export function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <List sx={{ pt: 1 }}>
      {navItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={NavLink}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setMobileOpen(false)}
          sx={{
            mx: 1,
            borderRadius: `${tokens.radius.md}px`,
            '&.active': {
              backgroundColor: tokens.color.primary,
              color: tokens.color.primaryForeground,
              '& .MuiListItemIcon-root': { color: tokens.color.primaryForeground },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: tokens.color.white,
          color: tokens.color.foreground,
          borderBottom: `1px solid ${tokens.color.border}`,
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: `${tokens.radius.md}px`,
              backgroundColor: tokens.color.primary,
              mr: 1.5,
            }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, fontSize: '1.125rem' }}>
            Arbify
          </Typography>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.color.primary, color: tokens.color.primaryForeground, fontSize: '0.875rem' }}>
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
          <Toolbar />
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: `1px solid ${tokens.color.border}` },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

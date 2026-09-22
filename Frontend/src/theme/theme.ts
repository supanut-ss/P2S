import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

/**
 * Buttons/inputs use spacing.3 (12px) vertical padding, larger than MUI's default —
 * the primary use case (goods-receiving scan) is a phone worked with one thumb, not
 * a mouse, per design/design-system-spec.md.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: tokens.color.primary,
      dark: tokens.color.primaryHover,
      contrastText: tokens.color.primaryForeground,
    },
    secondary: {
      main: tokens.color.secondary,
      contrastText: tokens.color.secondaryForeground,
    },
    success: { main: tokens.color.success },
    warning: { main: tokens.color.warning },
    error: { main: tokens.color.destructive },
    info: { main: tokens.color.info },
    background: {
      default: tokens.color.background,
      paper: tokens.color.white,
    },
    text: {
      primary: tokens.color.foreground,
      secondary: tokens.color.mutedForeground,
    },
    divider: tokens.color.border,
  },
  shape: {
    borderRadius: tokens.radius.default,
  },
  typography: {
    fontFamily: '"Segoe UI", "Noto Sans Thai", Roboto, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.md,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.md,
        },
        input: {
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.color.border}`,
          boxShadow: '0 1px 3px 0 rgb(20 28 28 / 0.10), 0 1px 2px -1px rgb(20 28 28 / 0.10)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.full,
          fontWeight: 600,
        },
      },
    },
  },
});

import { createTheme, type PaletteMode } from '@mui/material/styles';
import { tokens } from './tokens';

/**
 * Buttons/inputs use spacing.3 (12px) vertical padding, larger than MUI's default —
 * the primary use case (goods-receiving scan) is a phone worked with one thumb, not
 * a mouse, per design/design-system-spec.md.
 */
export function createAppTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  const color = dark ? tokens.dark : tokens.color;

  return createTheme({
    palette: {
      mode,
      contrastThreshold: 4.5,
      primary: {
        main: color.primaryText,
        dark: color.primaryTextHover,
        contrastText: tokens.color.primaryForeground,
      },
      secondary: {
        main: color.secondary,
        contrastText: color.secondaryForeground,
      },
      success: { main: color.successText },
      warning: { main: color.warningText, contrastText: tokens.color.warningForeground },
      error: { main: color.destructiveText },
      info: { main: color.infoText },
      background: {
        default: color.background,
        paper: color.surface,
      },
      text: {
        primary: color.foreground,
        secondary: color.mutedForeground,
      },
      divider: color.border,
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
            '&.MuiButton-containedPrimary': {
              backgroundColor: tokens.color.primary,
              color: tokens.color.primaryForeground,
              '&:hover': {
                backgroundColor: tokens.color.primaryHover,
                color: tokens.color.primaryForeground,
              },
            },
            '&.MuiButton-containedWarning': {
              backgroundColor: tokens.color.warning,
              color: tokens.color.warningForeground,
              '&:hover': {
                backgroundColor: tokens.color.warningHover,
                color: tokens.color.warningForeground,
              },
            },
            '&.MuiButton-outlinedPrimary': {
              borderColor: color.primaryText,
              color: color.primaryText,
              '&:hover': {
                borderColor: color.primaryTextHover,
                color: color.primaryTextHover,
              },
            },
            '&.MuiButton-outlinedWarning': {
              borderColor: color.warningText,
              color: color.warningText,
              '&:hover': {
                borderColor: color.warningText,
                color: color.warningText,
              },
            },
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
            border: `1px solid ${color.border}`,
            boxShadow: '0 1px 3px 0 rgb(20 28 28 / 0.10), 0 1px 2px -1px rgb(20 28 28 / 0.10)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.full,
            fontWeight: 600,
            '&.MuiChip-outlinedPrimary': {
              borderColor: color.primaryText,
              color: color.primaryText,
            },
          },
        },
      },
    },
  });
}

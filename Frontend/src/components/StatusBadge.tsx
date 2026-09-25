import { Chip, useTheme } from '@mui/material';
import { getStatusBadgeColors } from '../theme/tokens';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const theme = useTheme();
  const colors = getStatusBadgeColors(status, theme.palette.mode);
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: colors.backgroundColor,
        color: colors.color,
        fontSize: '0.75rem',
      }}
    />
  );
}

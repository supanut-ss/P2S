import { Chip } from '@mui/material';
import { getStatusColor } from '../theme/tokens';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const color = getStatusColor(status);
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: color,
        color: '#FFFFFF',
        fontSize: '0.75rem',
      }}
    />
  );
}

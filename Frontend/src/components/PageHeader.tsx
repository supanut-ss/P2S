import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: { xs: 2, md: 3 } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '1.4rem', sm: '1.5rem' }, textWrap: 'balance' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ textWrap: 'pretty' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ width: { xs: '100%', sm: 'auto' }, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, minHeight: 44 } }}>{action}</Box>}
    </Box>
  );
}

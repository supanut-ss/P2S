import { Box, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { tokens } from '../theme/tokens';

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Box
        sx={{
          border: `1px dashed ${tokens.color.border}`,
          borderRadius: `${tokens.radius.lg}px`,
          p: 6,
          textAlign: 'center',
          color: tokens.color.mutedForeground,
        }}
      >
        <Typography variant="body2">หน้านี้รอเชื่อมกับ API ที่ยังไม่ได้สร้าง (controller ฝั่ง backend)</Typography>
      </Box>
    </>
  );
}

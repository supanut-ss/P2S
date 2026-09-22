import { Card, CardContent, Grid, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';

const stats = [
  { label: 'ยอดสั่งวันนี้', value: '—' },
  { label: 'ยอดเบิกค้าง', value: '—' },
  { label: 'มูลค่าที่เข้าคลังวันนี้', value: '—' },
  { label: 'เคสยกเลิกที่ยังไม่เคลียร์', value: '—' },
];

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="สรุปวันนี้ — ยอดสั่ง/ยอดเบิก/ของค้างมา/มูลค่าที่เข้าคลัง/เคสยกเลิก" />
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {stat.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        รอเชื่อมกับ daily finance snapshot API (Phase 3)
      </Typography>
    </>
  );
}

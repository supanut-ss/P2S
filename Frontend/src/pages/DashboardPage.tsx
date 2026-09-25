import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Grid, LinearProgress, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { getLatestSnapshot, runSnapshotNow } from '../api/financeApi';
import type { DailyFinanceSnapshotResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DailyFinanceSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await getLatestSnapshot());
    } catch {
      setError('โหลดข้อมูลสรุปไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRunNow = async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await runSnapshotNow());
    } catch {
      setError('สั่งรันสรุปยอดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'ยอดสั่งวันนี้', value: snapshot ? thb.format(snapshot.totalOrderedAmount) : '—' },
    { label: 'ยอดเบิกค้าง', value: snapshot ? thb.format(snapshot.totalReimbursementPending) : '—' },
    { label: 'มูลค่าที่เข้าคลังวันนี้', value: snapshot ? thb.format(snapshot.totalInventoryValueToday) : '—' },
    { label: 'เคสยกเลิกที่ยังไม่เคลียร์', value: snapshot ? String(snapshot.openCancellationsCount) : '—' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={snapshot ? `ข้อมูล ณ วันที่ ${snapshot.snapshotDate}` : 'สรุปวันนี้ — ยอดสั่ง/ยอดเบิก/ของค้างมา/มูลค่าที่เข้าคลัง/เคสยกเลิก'}
        action={
          user?.role === 'admin' ? (
            <Button variant="outlined" size="small" onClick={handleRunNow} disabled={loading} sx={{ minHeight: 40 }}>
              รันสรุปยอดตอนนี้
            </Button>
          ) : undefined
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดภาพรวม" sx={{ mb: 2 }} />}
      {!loading && !snapshot && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>ยังไม่เคยรันสรุปยอด — ระบบจะรันอัตโนมัติทุกวัน 23:59</Alert>
      )}
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3 }, '&:last-child': { pb: { xs: 2.5, sm: 3 } } }}>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.75, fontSize: { xs: '1.75rem', sm: '2rem' }, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import { cancellationStatusLabel } from '../theme/tokens';
import { listCancellations, resolveCancellation } from '../api/cancellationsApi';
import type { CancellationResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

export function CancellationsPage() {
  const { user } = useAuth();
  const canResolve = user?.role === 'finance' || user?.role === 'admin';

  const [cancellations, setCancellations] = useState<CancellationResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('RefundPending');
  const [error, setError] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<{ id: number; productName: string; outcome: 'Refunded' | 'Adjusted' } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCancellations(await listCancellations(statusFilter || undefined));
    } catch {
      setError('โหลดรายการยกเลิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleResolve = async (id: number, outcome: 'Refunded' | 'Adjusted') => {
    if (resolving) return;
    setResolving(true);
    try {
      await resolveCancellation(id, outcome);
      setResolveTarget(null);
      await load();
    } catch {
      setError('บันทึกผลไม่สำเร็จ');
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <PageHeader title="รายการคืน/ยกเลิก" subtitle="ติดตามยอดเงินคืนและสต็อกที่ส่งคืนผู้ขาย" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดรายการยกเลิก" sx={{ mb: 2 }} />}

      <ResponsiveSelectField
        label="สถานะ"
        size="small"
        value={statusFilter}
        options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(cancellationStatusLabel).map(([value, label]) => ({ value, label }))]}
        onChange={(value) => setStatusFilter(String(value))}
        sx={{ mb: 2, minWidth: 180 }}
      />

      <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>สินค้า</TableCell>
              <TableCell>ออเดอร์</TableCell>
              <TableCell>ผู้สั่ง / ผู้บันทึก</TableCell>
              <TableCell align="right">จำนวน / เงินคืน</TableCell>
              <TableCell>ผูกกับ reimbursement</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>วันที่ยกเลิก</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cancellations.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.id}</TableCell>
                <TableCell>{c.productName}</TableCell>
                <TableCell>{c.platformCode} · {c.platformOrderNo}</TableCell>
                <TableCell>{c.requestedByUsername} / {c.reportedByUsername ?? '—'} / {c.resolvedByUsername ?? '—'}</TableCell>
                <TableCell align="right">{c.quantity} ชิ้น · {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(c.refundAmount)}</TableCell>
                <TableCell>{c.reimbursementId ?? '— (ยังไม่มีรายการเบิกที่จ่ายแล้ว)'}</TableCell>
                <TableCell><StatusBadge status={c.status} label={cancellationStatusLabel[c.status] ?? c.status} /></TableCell>
                <TableCell>{new Date(c.flaggedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {canResolve && c.status === 'RefundPending' && (
                    <>
                      <Button size="small" onClick={() => setResolveTarget({ id: c.id, productName: c.productName, outcome: 'Refunded' })}>คืนเงินแล้ว</Button>
                      <Button size="small" onClick={() => setResolveTarget({ id: c.id, productName: c.productName, outcome: 'Adjusted' })}>ปรับยอดแทน</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && cancellations.length === 0 && (
              <TableRow><TableCell colSpan={9} align="center">ไม่มีรายการ</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1.5 }}>
        {cancellations.map((c) => (
          <Paper key={c.id} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{c.productName}</Typography>
                <Typography variant="body2" color="text.secondary">รายการ #{c.id}</Typography>
                <Typography variant="body2" color="text.secondary">{c.platformCode} · {c.platformOrderNo}</Typography>
              </Box>
              <StatusBadge status={c.status} label={cancellationStatusLabel[c.status] ?? c.status} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Reimbursement</Typography>
              <Typography variant="body2" sx={{ textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{c.reimbursementId ?? '— (ยังไม่มีรายการเบิกที่จ่ายแล้ว)'}</Typography>
              <Typography variant="body2" color="text.secondary">จำนวน / เงินคืน</Typography>
              <Typography variant="body2" sx={{ textAlign: 'right' }}>{c.quantity} ชิ้น · {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(c.refundAmount)}</Typography>
              <Typography variant="body2" color="text.secondary">ผู้สั่ง / ผู้บันทึก</Typography>
              <Typography variant="body2" sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{c.requestedByUsername} / {c.reportedByUsername ?? '—'}</Typography>
              <Typography variant="body2" color="text.secondary">ผู้ปิดเคส</Typography>
              <Typography variant="body2" sx={{ textAlign: 'right' }}>{c.resolvedByUsername ?? '—'}</Typography>
              <Typography variant="body2" color="text.secondary">วันที่ยกเลิก</Typography>
              <Typography variant="body2">{new Date(c.flaggedAt).toLocaleDateString('th-TH')}</Typography>
            </Box>
            {canResolve && c.status === 'RefundPending' && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 2 }}>
                <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => setResolveTarget({ id: c.id, productName: c.productName, outcome: 'Refunded' })}>คืนเงินแล้ว</Button>
                <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => setResolveTarget({ id: c.id, productName: c.productName, outcome: 'Adjusted' })}>ปรับยอดแทน</Button>
              </Box>
            )}
          </Paper>
        ))}
        {!loading && cancellations.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>ไม่มีรายการ</Paper>
        )}
      </Box>
      <Dialog open={resolveTarget !== null} onClose={() => !resolving && setResolveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ยืนยันผลการคืน/ยกเลิก</DialogTitle>
        <DialogContent><DialogContentText>บันทึก {resolveTarget?.productName} เป็น “{resolveTarget?.outcome === 'Refunded' ? 'คืนเงินแล้ว' : 'ปรับยอดแล้ว'}”?</DialogContentText></DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setResolveTarget(null)} disabled={resolving}>กลับ</Button>
          <Button variant="contained" disabled={resolving} onClick={() => resolveTarget && handleResolve(resolveTarget.id, resolveTarget.outcome)}>ยืนยัน</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

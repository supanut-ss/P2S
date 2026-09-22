import { useEffect, useState } from 'react';
import {
  Alert, Button, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
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

  const load = async () => {
    setError(null);
    try {
      setCancellations(await listCancellations(statusFilter || undefined));
    } catch {
      setError('โหลดรายการยกเลิกไม่สำเร็จ');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleResolve = async (id: number, outcome: 'Refunded' | 'Adjusted') => {
    try {
      await resolveCancellation(id, outcome);
      await load();
    } catch {
      setError('บันทึกผลไม่สำเร็จ');
    }
  };

  return (
    <>
      <PageHeader title="Cancellation report" subtitle="รายการรอ action ฝ่ายการเงิน (ของที่ไม่เข้าคลังแต่จ่าย/เบิกไปแล้ว)" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField select label="สถานะ" size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ mb: 2, minWidth: 180 }}>
        <MenuItem value="">ทุกสถานะ</MenuItem>
        {Object.entries(cancellationStatusLabel).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
      </TextField>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>สินค้า</TableCell>
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
                <TableCell>{c.reimbursementId ?? '— (ยังไม่เคยเบิก ไม่ต้องคืนเงิน)'}</TableCell>
                <TableCell><StatusBadge status={c.status} label={cancellationStatusLabel[c.status] ?? c.status} /></TableCell>
                <TableCell>{new Date(c.flaggedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {canResolve && c.status === 'RefundPending' && c.reimbursementId !== null && (
                    <>
                      <Button size="small" onClick={() => handleResolve(c.id, 'Refunded')}>คืนเงินแล้ว</Button>
                      <Button size="small" onClick={() => handleResolve(c.id, 'Adjusted')}>ปรับยอดแทน</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {cancellations.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">ไม่มีรายการ</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

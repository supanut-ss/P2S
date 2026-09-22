import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, MenuItem, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { reimbursementStatusLabel } from '../theme/tokens';
import { approveReimbursement, createReimbursement, listReimbursements, payReimbursement } from '../api/reimbursementsApi';
import { listOrders } from '../api/ordersApi';
import type { PurchaseOrderResponse, ReimbursementResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function ReimbursementsPage() {
  const { user } = useAuth();
  const canActOnBehalfOfFinance = user?.role === 'finance' || user?.role === 'admin';

  const [reimbursements, setReimbursements] = useState<ReimbursementResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [eligibleOrders, setEligibleOrders] = useState<PurchaseOrderResponse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [reimbursementsData, ordersData] = await Promise.all([
        listReimbursements(statusFilter || undefined),
        listOrders({ status: 'PaidByStaff', excludeRequested: true }),
      ]);
      setReimbursements(reimbursementsData);
      setEligibleOrders(ordersData);
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreateRequest = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReimbursement([...selected]);
      setSelected(new Set());
      setMessage('ส่งคำขอเบิกเงินแล้ว');
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'ส่งคำขอเบิกเงินไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveReimbursement(id);
      await load();
    } catch {
      setError('อนุมัติไม่สำเร็จ');
    }
  };

  const handlePay = async (id: number) => {
    try {
      await payReimbursement(id);
      await load();
    } catch {
      setError('จ่ายเงินไม่สำเร็จ');
    }
  };

  const selectedTotal = eligibleOrders.filter((o) => selected.has(o.id)).reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <>
      <PageHeader title="Reimbursement queue" subtitle="ฝ่ายการเงินอนุมัติ/จ่ายเป็นชุด (แยกอิสระจากหน้าสแกน/คลัง)" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>ออเดอร์ที่จ่ายแล้ว รอขอเบิก</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Platform</TableCell>
              <TableCell>เลขออเดอร์</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {eligibleOrders.map((o) => (
              <TableRow key={o.id} hover onClick={() => toggleSelect(o.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox"><Checkbox checked={selected.has(o.id)} /></TableCell>
                <TableCell>{o.platformCode}</TableCell>
                <TableCell>{o.platformOrderNo}</TableCell>
                <TableCell align="right">{thb.format(o.totalAmount)}</TableCell>
              </TableRow>
            ))}
            {eligibleOrders.length === 0 && (
              <TableRow><TableCell colSpan={4} align="center">ไม่มีออเดอร์ที่รอขอเบิก</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="body2">เลือกแล้ว {selected.size} ออเดอร์ — ยอดรวม {thb.format(selectedTotal)}</Typography>
        <Button variant="contained" disabled={selected.size === 0 || submitting} onClick={handleCreateRequest}>ส่งคำขอเบิกเงิน</Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>คำขอเบิกเงิน</Typography>
        <TextField select label="สถานะ" size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">ทุกสถานะ</MenuItem>
          {Object.entries(reimbursementStatusLabel).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </TextField>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>ผู้ขอเบิก</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>วันที่ขอ</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reimbursements.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.requestedByUsername}</TableCell>
                <TableCell align="right">{thb.format(r.totalAmount)}</TableCell>
                <TableCell><StatusBadge status={r.status} label={reimbursementStatusLabel[r.status] ?? r.status} /></TableCell>
                <TableCell>{new Date(r.requestedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {canActOnBehalfOfFinance && r.status === 'Pending' && (
                    <Button size="small" onClick={() => handleApprove(r.id)}>อนุมัติ</Button>
                  )}
                  {canActOnBehalfOfFinance && r.status === 'Approved' && (
                    <Button size="small" onClick={() => handlePay(r.id)}>จ่ายเงิน</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {reimbursements.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">ไม่มีคำขอเบิกเงิน</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

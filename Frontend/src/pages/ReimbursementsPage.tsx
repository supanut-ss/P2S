import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, LinearProgress, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import { reimbursementStatusLabel } from '../theme/tokens';
import { approveReimbursement, createReimbursement, listReimbursements, payReimbursement } from '../api/reimbursementsApi';
import { listOrders } from '../api/ordersApi';
import type { PurchaseOrderResponse, ReimbursementResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function ReimbursementsPage() {
  const { user } = useAuth();
  const canRequestReimbursement = user?.role === 'staff' || user?.role === 'admin';
  const canReviewReimbursements = user?.role === 'finance' || user?.role === 'admin';

  const [reimbursements, setReimbursements] = useState<ReimbursementResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [eligibleOrders, setEligibleOrders] = useState<PurchaseOrderResponse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reimbursementsData, ordersData] = await Promise.all([
        listReimbursements(statusFilter || undefined),
        canRequestReimbursement
          ? listOrders({ status: 'PaidByStaff', excludeRequested: true })
          : Promise.resolve<PurchaseOrderResponse[]>([]),
      ]);
      setReimbursements(reimbursementsData);
      setEligibleOrders(ordersData);
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
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
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await approveReimbursement(id);
      await load();
    } catch {
      setError('อนุมัติไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const handlePay = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await payReimbursement(id);
      await load();
    } catch {
      setError('จ่ายเงินไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const selectedTotal = eligibleOrders.filter((o) => selected.has(o.id)).reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <>
      <PageHeader
        title={canReviewReimbursements ? 'คิวตรวจสอบการเบิกเงิน' : 'ขอเบิกเงิน'}
        subtitle={canReviewReimbursements
          ? 'ตรวจสอบคำขอของพนักงาน อนุมัติ และบันทึกการจ่ายเงิน'
          : 'ส่งคำขอสำหรับออเดอร์ที่คุณสำรองจ่าย และติดตามสถานะ'}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดคำขอเบิกเงิน" sx={{ mb: 2 }} />}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      {canRequestReimbursement && (
        <>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>ออเดอร์ที่คุณสำรองจ่ายและรอขอเบิก</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 1, display: { xs: 'none', lg: 'block' } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>แพลตฟอร์ม</TableCell>
              <TableCell>เลขออเดอร์</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {eligibleOrders.map((o) => (
              <TableRow key={o.id} hover onClick={() => toggleSelect(o.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox"><Checkbox checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} onClick={(event) => event.stopPropagation()} slotProps={{ input: { 'aria-label': `เลือกออเดอร์ ${o.platformOrderNo}` } }} /></TableCell>
                <TableCell>{o.platformCode}</TableCell>
                <TableCell>{o.platformOrderNo}</TableCell>
                <TableCell align="right">{thb.format(o.totalAmount)}</TableCell>
              </TableRow>
            ))}
            {!loading && eligibleOrders.length === 0 && (
              <TableRow><TableCell colSpan={4} align="center">ไม่มีออเดอร์ที่รอขอเบิก</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack spacing={1} sx={{ display: { xs: 'flex', lg: 'none' }, mb: 2 }}>
        {eligibleOrders.map((o) => (
          <Card key={o.id} variant="outlined">
            <CardContent sx={{ '&:last-child': { pb: 2 }, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} slotProps={{ input: { 'aria-label': `เลือกออเดอร์ ${o.platformOrderNo}` } }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{o.platformOrderNo}</Typography>
                  <Typography variant="body2" color="text.secondary">{o.platformCode}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(o.totalAmount)}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
        {!loading && eligibleOrders.length === 0 && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>ไม่มีออเดอร์ที่รอขอเบิก</Typography>}
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 4 }}>
        <Typography variant="body2">เลือกแล้ว {selected.size} ออเดอร์ — ยอดรวม {thb.format(selectedTotal)}</Typography>
        <Button variant="contained" disabled={selected.size === 0 || submitting} onClick={handleCreateRequest} sx={{ minHeight: 44 }}>ส่งคำขอเบิกเงิน</Button>
      </Box>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {user?.role === 'staff' ? 'คำขอของฉัน' : canReviewReimbursements ? 'คำขอจากพนักงาน' : 'คำขอเบิกเงิน'}
        </Typography>
        <ResponsiveSelectField
          label="สถานะ"
          size="small"
          value={statusFilter}
          options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(reimbursementStatusLabel).map(([value, label]) => ({ value, label }))]}
          onChange={(value) => setStatusFilter(String(value))}
          sx={{ minWidth: { sm: 180 }, width: { xs: '100%', sm: 'auto' } }}
        />
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
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
                  {canReviewReimbursements && r.status === 'Pending' && (
                    <Button size="small" disabled={busyId !== null} onClick={() => handleApprove(r.id)}>อนุมัติ</Button>
                  )}
                  {canReviewReimbursements && r.status === 'Approved' && (
                    <Button size="small" disabled={busyId !== null} onClick={() => handlePay(r.id)}>จ่ายเงิน</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && reimbursements.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">ไม่มีคำขอเบิกเงิน</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack spacing={1} sx={{ display: { xs: 'flex', lg: 'none' } }}>
        {reimbursements.map((r) => (
          <Card key={r.id} variant="outlined">
            <CardContent sx={{ '&:last-child': { pb: 2 }, py: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Box><Typography sx={{ fontWeight: 700 }}>คำขอ #{r.id}</Typography><Typography variant="body2" color="text.secondary">{r.requestedByUsername} · {new Date(r.requestedAt).toLocaleDateString('th-TH')}</Typography></Box>
                <StatusBadge status={r.status} label={reimbursementStatusLabel[r.status] ?? r.status} />
              </Box>
              <Typography sx={{ mb: 1.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(r.totalAmount)}</Typography>
              {canReviewReimbursements && r.status === 'Pending' && <Button fullWidth variant="outlined" disabled={busyId !== null} onClick={() => handleApprove(r.id)} sx={{ minHeight: 44 }}>อนุมัติ</Button>}
              {canReviewReimbursements && r.status === 'Approved' && <Button fullWidth variant="contained" disabled={busyId !== null} onClick={() => handlePay(r.id)} sx={{ minHeight: 44 }}>จ่ายเงิน</Button>}
            </CardContent>
          </Card>
        ))}
        {!loading && reimbursements.length === 0 && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>ไม่มีคำขอเบิกเงิน</Typography>}
      </Stack>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, Typography,
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { PageHeader } from '../components/PageHeader';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import {
  AppDataGrid,
  AppDataGridToolbar,
  DataGridStatusChip,
} from '../components/data-grid';
import { cancellationStatusLabel } from '../theme/tokens';
import { listCancellations, resolveCancellation } from '../api/cancellationsApi';
import type { CancellationResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

const cancellationStatusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'RefundPending', label: 'รอคืนเงิน' },
  { value: 'Refunded', label: 'คืนเงินแล้ว' },
  { value: 'Adjusted', label: 'ปรับยอดแล้ว' },
];

export function CancellationsPage() {
  const { user } = useAuth();
  const canResolve = user?.role === 'finance' || user?.role === 'admin';

  const [cancellations, setCancellations] = useState<CancellationResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('RefundPending');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<{ id: number; productName: string; outcome: 'Refunded' | 'Adjusted' } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
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
    setResolveError(null);
    setResolving(true);
    try {
      await resolveCancellation(id, outcome);
      setResolveTarget(null);
      await load();
    } catch {
      setResolveError('บันทึกผลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setResolving(false);
    }
  };

  const openResolveDialog = (cancellation: CancellationResponse, outcome: 'Refunded' | 'Adjusted') => {
    setResolveError(null);
    setResolveTarget({ id: cancellation.id, productName: cancellation.productName, outcome });
  };

  const closeResolveDialog = () => {
    if (resolving) return;
    setResolveError(null);
    setResolveTarget(null);
  };

  const filteredCancellations = useMemo(() => {
    if (!search.trim()) return cancellations;
    const q = search.trim().toLowerCase();
    return cancellations.filter((c) =>
      c.id.toString().includes(q) ||
      c.productName.toLowerCase().includes(q) ||
      c.platformOrderNo.toLowerCase().includes(q) ||
      c.platformCode.toLowerCase().includes(q) ||
      c.requestedByUsername.toLowerCase().includes(q) ||
      (c.reportedByUsername && c.reportedByUsername.toLowerCase().includes(q)) ||
      (c.resolvedByUsername && c.resolvedByUsername.toLowerCase().includes(q))
    );
  }, [cancellations, search]);

  const sortedCancellations = useMemo(() => {
    return [...filteredCancellations].sort(
      (a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
    );
  }, [filteredCancellations]);

  const cancellationColumns: GridColDef<CancellationResponse>[] = useMemo(() => [
    {
      field: 'id',
      headerName: '#',
      width: 70,
    },
    {
      field: 'productName',
      headerName: 'สินค้า',
      flex: 1.5,
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'order',
      headerName: 'ออเดอร์',
      width: 170,
      valueGetter: (_v, row) => `${row.platformCode} · ${row.platformOrderNo}`,
    },
    {
      field: 'users',
      headerName: 'ผู้สั่ง / ผู้บันทึก',
      flex: 1.3,
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {params.row.requestedByUsername} / {params.row.reportedByUsername ?? '—'} / {params.row.resolvedByUsername ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'refundAmount',
      headerName: 'จำนวน / เงินคืน',
      type: 'number',
      width: 170,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.row.quantity} ชิ้น · {thb.format(params.row.refundAmount)}
        </Typography>
      ),
    },
    {
      field: 'reimbursementId',
      headerName: 'ผูกกับ reimbursement',
      width: 190,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {params.value ? `Reimbursement #${params.value}` : '— (ยังไม่มีรายการเบิก)'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 150,
      renderCell: (params) => (
        <DataGridStatusChip
          status={params.value}
          label={cancellationStatusLabel[params.value] ?? params.value}
        />
      ),
    },
    {
      field: 'flaggedAt',
      headerName: 'วันที่ยกเลิก',
      width: 130,
      valueFormatter: (value: string) => new Date(value).toLocaleDateString('th-TH'),
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 200,
      sortable: false,
      filterable: false,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => {
        const c = params.row;
        if (!canResolve || c.status !== 'RefundPending') return null;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
            <Button size="small" variant="outlined" onClick={() => openResolveDialog(c, 'Refunded')}>
              คืนเงินแล้ว
            </Button>
            <Button size="small" variant="outlined" onClick={() => openResolveDialog(c, 'Adjusted')}>
              ปรับยอดแทน
            </Button>
          </Box>
        );
      },
    },
  ], [canResolve]);

  return (
    <>
      <PageHeader title="รายการคืน/ยกเลิก" subtitle="ติดตามยอดเงินคืนและสต็อกที่ส่งคืนผู้ขาย" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดรายการยกเลิก" sx={{ mb: 2 }} />}

      {/* Mobile status select */}
      <Box sx={{ display: { xs: 'block', lg: 'none' }, mb: 2 }}>
        <ResponsiveSelectField
          label="สถานะ"
          size="small"
          value={statusFilter}
          options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(cancellationStatusLabel).map(([value, label]) => ({ value, label }))]}
          onChange={(value) => setStatusFilter(String(value))}
          sx={{ width: '100%' }}
        />
      </Box>

      {/* Desktop DataGrid */}
      <Box sx={{ display: { xs: 'none', lg: 'block' }, mb: 2 }}>
        <AppDataGrid
          rows={filteredCancellations}
          columns={cancellationColumns}
          getRowId={(row) => row.id}
          loading={loading}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          pageSizeOptions={[10, 25, 50]}
          autoHeight
          toolbar={
            <AppDataGridToolbar
              statusOptions={cancellationStatusOptions}
              selectedStatus={statusFilter}
              onStatusChange={(v) => setStatusFilter(v)}
              searchValue={search}
              onSearchChange={(v) => setSearch(v)}
              searchPlaceholder="ค้นหาสินค้า, เลขออเดอร์, ผู้ใช้…"
            />
          }
        />
      </Box>

      <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1.5 }}>
        {sortedCancellations.map((c) => (
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
                <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => openResolveDialog(c, 'Refunded')}>คืนเงินแล้ว</Button>
                <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => openResolveDialog(c, 'Adjusted')}>ปรับยอดแทน</Button>
              </Box>
            )}
          </Paper>
        ))}
        {!loading && sortedCancellations.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>ไม่มีรายการ</Paper>
        )}
      </Box>
      <Dialog open={resolveTarget !== null} onClose={closeResolveDialog} maxWidth="xs" fullWidth>
        <DialogTitle>ยืนยันผลการคืน/ยกเลิก</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {resolveError && <Alert severity="error" role="alert">{resolveError}</Alert>}
          <DialogContentText>บันทึก {resolveTarget?.productName} เป็น “{resolveTarget?.outcome === 'Refunded' ? 'คืนเงินแล้ว' : 'ปรับยอดแล้ว'}”?</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={closeResolveDialog} disabled={resolving}>กลับ</Button>
          <Button variant="contained" disabled={resolving} onClick={() => resolveTarget && handleResolve(resolveTarget.id, resolveTarget.outcome)}>ยืนยัน</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

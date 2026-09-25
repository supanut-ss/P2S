import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { PageHeader } from '../components/PageHeader';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import {
  AppDataGrid,
  AppDataGridToolbar,
  DataGridStatusChip,
} from '../components/data-grid';
import { reimbursementStatusLabel } from '../theme/tokens';
import { approveReimbursement, correctOrderPaymentAmount, createReimbursement, listReimbursements, payReimbursement } from '../api/reimbursementsApi';
import { getPaymentEvidence, listOrders } from '../api/ordersApi';
import { getStaffBalances } from '../api/financeApi';
import type { PurchaseOrderResponse, ReimbursementResponse, StaffBalanceResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
type ReimbursementOrderDetail = ReimbursementResponse['purchaseOrders'][number];

const reimbursementStatusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'Pending', label: 'รอตรวจสอบ' },
  { value: 'Approved', label: 'อนุมัติแล้ว' },
  { value: 'Paid', label: 'จ่ายแล้ว' },
  { value: 'Voided', label: 'ยกเลิก' },
];

export function ReimbursementsPage() {
  const { user } = useAuth();
  const canRequestReimbursement = user?.role === 'staff' || user?.role === 'admin';
  const canReviewReimbursements = user?.role === 'finance' || user?.role === 'admin';

  const [reimbursements, setReimbursements] = useState<ReimbursementResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [eligibleOrders, setEligibleOrders] = useState<PurchaseOrderResponse[]>([]);
  const [staffBalances, setStaffBalances] = useState<StaffBalanceResponse[]>([]);
  const [auditTarget, setAuditTarget] = useState<ReimbursementResponse | null>(null);
  const [editingPayment, setEditingPayment] = useState<{ reimbursementId: number; purchaseOrderId: number; platformOrderNo: string } | null>(null);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
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
      const [reimbursementsData, ordersData, balancesData] = await Promise.all([
        listReimbursements(statusFilter || undefined),
        canRequestReimbursement
          ? listOrders({ status: 'PaidByStaff', excludeRequested: true })
          : Promise.resolve<PurchaseOrderResponse[]>([]),
        canReviewReimbursements ? getStaffBalances() : Promise.resolve<StaffBalanceResponse[]>([]),
      ]);
      setReimbursements(reimbursementsData);
      setEligibleOrders(ordersData);
      setStaffBalances(balancesData);
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

  const rowSelectionModel = useMemo<GridRowSelectionModel>(() => ({
    type: 'include',
    ids: new Set(selected),
  }), [selected]);

  const handleRowSelectionModelChange = (model: GridRowSelectionModel) => {
    setSelected(new Set(Array.from(model.ids).map(Number)));
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

  const handleApprove = useCallback(async (id: number) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyId]);

  const handlePay = useCallback(async (id: number) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyId]);

  const selectedTotal = eligibleOrders.filter((o) => selected.has(o.id)).reduce((sum, o) => sum + (o.reimbursableAmount ?? o.actualPaidAmount ?? o.totalAmount), 0);

  const filteredReimbursements = useMemo(() => {
    if (!search.trim()) return reimbursements;
    const q = search.trim().toLowerCase();
    return reimbursements.filter((r) =>
      r.id.toString().includes(q) ||
      r.requestedByUsername.toLowerCase().includes(q) ||
      r.purchaseOrders.some((po) =>
        po.platformOrderNo.toLowerCase().includes(q) ||
        po.platformCode.toLowerCase().includes(q) ||
        po.items.some((it) => it.productName.toLowerCase().includes(q))
      )
    );
  }, [reimbursements, search]);

  const sortedReimbursements = useMemo(() => {
    return [...filteredReimbursements].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }, [filteredReimbursements]);

  const sortedEligibleOrders = useMemo(() => {
    return [...eligibleOrders].sort((a, b) =>
      a.platformOrderNo.localeCompare(b.platformOrderNo, 'th')
    );
  }, [eligibleOrders]);

  const renderOrderDetails = (request: ReimbursementResponse) => (
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      {request.purchaseOrders.map((order) => (
        <Box key={order.id} sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {order.platformCode} · {order.platformOrderNo}
          </Typography>
          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
            {order.items.map((item) => (
              <Typography key={item.id} variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {item.productName} × {item.qty} · {thb.format(item.unitPrice)}/ชิ้น
                {item.returnedQty > 0 ? ` · ส่งคืน ${item.returnedQty}` : ''}
              </Typography>
            ))}
          </Stack>
        </Box>
      ))}
      {request.purchaseOrders.length === 0 && <Typography variant="caption" color="text.secondary">ไม่มีรายการสินค้า</Typography>}
    </Stack>
  );

  const downloadEvidence = async (orderId: number) => {
    try {
      const blob = await getPaymentEvidence(orderId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payment-evidence-${orderId}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('เปิดหลักฐานการจ่ายไม่สำเร็จ');
    }
  };

  const openPaymentCorrection = (reimbursementId: number, orderId: number, orderNo: string, amount: number | null) => {
    setEditingPayment({ reimbursementId, purchaseOrderId: orderId, platformOrderNo: orderNo });
    setPaymentAmountDraft(String(amount ?? 0));
    setCorrectionReason('');
    setCorrectionError(null);
  };

  const canCorrectPayment = (request: ReimbursementResponse, order: ReimbursementOrderDetail) =>
    canReviewReimbursements && ['Pending', 'Approved'].includes(request.status) && order.paymentSource === 'StaffAdvance';

  const renderAuditItems = (order: ReimbursementOrderDetail) => (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      {order.items.map((item) => (
        <Typography key={item.id} variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {item.productName} × {item.qty} · {thb.format(item.unitPrice)}/ชิ้น
          {item.returnedQty > 0 ? ` · ส่งคืน ${item.returnedQty}` : ''}
        </Typography>
      ))}
      {order.items.length === 0 && <Typography variant="caption" color="text.secondary">ไม่มีรายการสินค้า</Typography>}
    </Stack>
  );

  const renderCorrectionButton = (request: ReimbursementResponse, order: ReimbursementOrderDetail) => (
    canCorrectPayment(request, order) && (
      <Button
        size="small"
        aria-label={`แก้ยอดจ่ายจริง Order ${order.platformOrderNo}`}
        disabled={savingCorrection || busyId !== null}
        onClick={() => openPaymentCorrection(request.id, order.id, order.platformOrderNo, order.actualPaidAmount ?? order.orderItemAmount)}
      >
        แก้ยอด
      </Button>
    )
  );

  const renderAmountCorrections = (order: ReimbursementOrderDetail, alignment: 'left' | 'right' = 'left') => (
    order.amountCorrections.length > 0 && (
      <Stack
        spacing={0.5}
        sx={{
          maxWidth: alignment === 'right' ? 260 : 'none',
          textAlign: alignment,
          alignItems: alignment === 'right' ? 'flex-end' : 'stretch',
        }}
      >
        {order.amountCorrections.map((correction) => (
          <Box key={correction.id}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
              {thb.format(correction.previousActualPaidAmount)} → {thb.format(correction.correctedActualPaidAmount)} · {correction.correctedByUsername} · {new Date(correction.correctedAt).toLocaleString('th-TH')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>เหตุผล: {correction.reason}</Typography>
            {correction.previousRequestStatus === 'Approved' && correction.previousApprovedByUsername && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>อนุมัติเดิมโดย {correction.previousApprovedByUsername}</Typography>
            )}
          </Box>
        ))}
      </Stack>
    )
  );

  const handleCorrectPaymentAmount = async () => {
    if (!editingPayment) return;
    const amount = Number(paymentAmountDraft);
    if (!paymentAmountDraft.trim() || !Number.isFinite(amount) || amount < 0 || Number(amount.toFixed(2)) !== amount) {
      setCorrectionError('กรุณาระบุยอดตั้งแต่ 0 บาท และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
      return;
    }
    if (!correctionReason.trim()) {
      setCorrectionError('กรุณาระบุเหตุผลที่แก้ไขยอด');
      return;
    }

    setSavingCorrection(true);
    setCorrectionError(null);
    try {
      const wasApproved = auditTarget?.id === editingPayment.reimbursementId && auditTarget.status === 'Approved';
      const updated = await correctOrderPaymentAmount(
        editingPayment.reimbursementId,
        editingPayment.purchaseOrderId,
        amount,
        correctionReason.trim(),
      );
      setReimbursements((current) => current.map((item) => item.id === updated.id ? updated : item));
      setAuditTarget(updated);
      setEditingPayment(null);
      setMessage(wasApproved
        ? 'แก้ยอดแล้ว คำขอกลับไปรออนุมัติใหม่'
        : 'แก้ยอดจ่ายจริงและบันทึกประวัติแล้ว');
      await load();
    } catch (err: unknown) {
      const responseMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCorrectionError(responseMessage ?? 'แก้ยอดจ่ายจริงไม่สำเร็จ');
    } finally {
      setSavingCorrection(false);
    }
  };

  const staffBalanceColumns: GridColDef<StaffBalanceResponse>[] = useMemo(() => [
    {
      field: 'fullName',
      headerName: 'พนักงาน',
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {params.row.fullName}{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            ({params.row.username})
          </Typography>
        </Typography>
      ),
    },
    {
      field: 'totalAdvanced',
      headerName: 'สำรองจ่าย',
      type: 'number',
      width: 140,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (value: number) => thb.format(value),
    },
    {
      field: 'totalReimbursed',
      headerName: 'บริษัทจ่ายคืน',
      type: 'number',
      width: 140,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (value: number) => thb.format(value),
    },
    {
      field: 'totalRefundDue',
      headerName: 'คืน/ปรับยอดค้างสุทธิ',
      type: 'number',
      width: 170,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (value: number) => thb.format(value),
    },
    {
      field: 'totalAdjustments',
      headerName: 'ปรับยอดก่อนเบิก',
      type: 'number',
      width: 150,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (value: number) => thb.format(value),
    },
    {
      field: 'balance',
      headerName: 'ยอดค้างสุทธิ',
      type: 'number',
      width: 150,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {thb.format(params.row.balance)}
        </Typography>
      ),
    },
  ], []);

  const eligibleColumns: GridColDef<PurchaseOrderResponse>[] = useMemo(() => [
    {
      field: 'platformCode',
      headerName: 'แพลตฟอร์ม',
      width: 130,
    },
    {
      field: 'platformOrderNo',
      headerName: 'เลขออเดอร์ / สินค้า',
      flex: 2,
      minWidth: 260,
      renderCell: (params) => {
        const o = params.row;
        return (
          <Box sx={{ py: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {o.platformOrderNo}
            </Typography>
            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
              {o.items.map((item) => (
                <Typography key={item.id} variant="caption" color="text.secondary">
                  {item.productName} × {item.qty} · {thb.format(item.unitPrice)}/ชิ้น
                  {item.returnedQty > 0 ? ` · ส่งคืน ${item.returnedQty}` : ''}
                </Typography>
              ))}
            </Stack>
          </Box>
        );
      },
    },
    {
      field: 'orderedAt',
      headerName: 'วันที่สั่ง',
      width: 110,
      valueFormatter: (value: string) => new Date(value).toLocaleDateString('th-TH'),
    },
    {
      field: 'reimbursableAmount',
      headerName: 'ยอดเบิกสุทธิ',
      type: 'number',
      width: 150,
      headerAlign: 'right',
      align: 'right',
      valueGetter: (_v, row) => row.reimbursableAmount ?? row.actualPaidAmount ?? row.totalAmount,
      valueFormatter: (value: number) => thb.format(value),
    },
  ], []);

  const reimbursementColumns: GridColDef<ReimbursementResponse>[] = useMemo(() => [
    {
      field: 'id',
      headerName: '#',
      width: 70,
    },
    {
      field: 'requestedByUsername',
      headerName: 'ผู้ขอเบิก',
      width: 140,
    },
    {
      field: 'purchaseOrders',
      headerName: 'ออเดอร์ / รายการสินค้า',
      flex: 2,
      minWidth: 280,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ py: 1 }}>
          {renderOrderDetails(params.row)}
        </Box>
      ),
    },
    {
      field: 'totalAmount',
      headerName: 'ยอดรวม',
      type: 'number',
      width: 150,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (value: number) => thb.format(value),
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 160,
      renderCell: (params) => (
        <DataGridStatusChip
          status={params.value}
          label={reimbursementStatusLabel[params.value] ?? params.value}
        />
      ),
    },
    {
      field: 'requestedAt',
      headerName: 'วันที่ขอ',
      width: 130,
      valueFormatter: (value: string) => new Date(value).toLocaleDateString('th-TH'),
    },
    {
      field: 'approvedAt',
      headerName: 'อนุมัติเมื่อ',
      width: 110,
      valueFormatter: (value: string | null) => value ? new Date(value).toLocaleDateString('th-TH') : '—',
    },
    {
      field: 'paidAt',
      headerName: 'จ่ายเมื่อ',
      width: 110,
      valueFormatter: (value: string | null) => value ? new Date(value).toLocaleDateString('th-TH') : '—',
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
        const r = params.row;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', width: '100%', py: 0.5 }}>
            <Button size="small" onClick={() => setAuditTarget(r)}>
              ตรวจสอบ
            </Button>
            {canReviewReimbursements && r.status === 'Pending' && (
              <Button
                size="small"
                variant="contained"
                disabled={busyId !== null}
                onClick={() => handleApprove(r.id)}
              >
                อนุมัติ
              </Button>
            )}
            {canReviewReimbursements && r.status === 'Approved' && (
              <Button
                size="small"
                variant="contained"
                color="success"
                disabled={busyId !== null}
                onClick={() => handlePay(r.id)}
              >
                จ่ายเงิน
              </Button>
            )}
          </Box>
        );
      },
    },
  ], [busyId, canReviewReimbursements, handleApprove, handlePay]);

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

      {canReviewReimbursements && (
        <Paper component="section" aria-labelledby="staff-balances-title" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
          <Typography id="staff-balances-title" variant="subtitle1" sx={{ fontWeight: 700 }}>ยอดค้างแยกตามพนักงาน</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>ยอดบวก = บริษัทค้างจ่ายพนักงาน · ยอดลบ = พนักงานต้องคืนบริษัท</Typography>
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <AppDataGrid
              rows={staffBalances}
              columns={staffBalanceColumns}
              getRowId={(row) => row.userId}
              loading={loading}
              hideFooter={staffBalances.length <= 5}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } },
              }}
              pageSizeOptions={[5, 10]}
              autoHeight
            />
          </Box>
          <Stack spacing={1} sx={{ display: { xs: 'flex', lg: 'none' } }}>
            {staffBalances.map((balance) => (
              <Box key={balance.userId} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{balance.fullName}</Typography>
                <Typography variant="caption" color="text.secondary">{balance.username}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, mt: 1.25 }}>
                  {([
                    ['สำรองจ่าย', balance.totalAdvanced],
                    ['บริษัทจ่ายคืน', balance.totalReimbursed],
                    ['คืน/ปรับยอดค้างสุทธิ', balance.totalRefundDue],
                    ['ปรับยอดก่อนเบิก', balance.totalAdjustments],
                  ] as const).map(([label, amount]) => (
                    <Box key={label} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{thb.format(amount)}</Typography>
                    </Box>
                  ))}
                  <Box sx={{ gridColumn: '1 / -1', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>ยอดค้างสุทธิ</Typography>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{thb.format(balance.balance)}</Typography>
                  </Box>
                </Box>
              </Box>
            ))}
            {!loading && staffBalances.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>ยังไม่มีรายการค้าง</Typography>
            )}
          </Stack>
        </Paper>
      )}

      {canRequestReimbursement && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>ออเดอร์ที่คุณสำรองจ่ายและรอขอเบิก</Typography>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, mb: 2 }}>
        <AppDataGrid
          rows={eligibleOrders}
          columns={eligibleColumns}
          getRowId={(row) => row.id}
          loading={loading}
          checkboxSelection
          rowSelectionModel={rowSelectionModel}
          onRowSelectionModelChange={handleRowSelectionModelChange}
          getRowHeight={() => 'auto'}
          initialState={{
            pagination: { paginationModel: { pageSize: 5 } },
          }}
          pageSizeOptions={[5, 10, 20]}
          autoHeight
        />
      </Box>
      <Stack spacing={1} sx={{ display: { xs: 'flex', lg: 'none' }, mb: 2 }}>
        {sortedEligibleOrders.map((o) => (
          <Card key={o.id} variant="outlined">
            <CardContent sx={{ '&:last-child': { pb: 2 }, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} slotProps={{ input: { 'aria-label': `เลือกออเดอร์ ${o.platformOrderNo}` } }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{o.platformOrderNo}</Typography>
                  <Typography variant="body2" color="text.secondary">{o.platformCode}</Typography>
                  <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                    {o.items.map((item) => (
                      <Typography key={item.id} variant="caption" color="text.secondary">
                        {item.productName} × {item.qty} · {thb.format(item.unitPrice)}/ชิ้น
                        {item.returnedQty > 0 ? ` · ส่งคืน ${item.returnedQty}` : ''}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(o.reimbursableAmount ?? o.actualPaidAmount ?? o.totalAmount)}</Typography>
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

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {user?.role === 'staff' ? 'คำขอของฉัน' : canReviewReimbursements ? 'คำขอจากพนักงาน' : 'คำขอเบิกเงิน'}
      </Typography>

      {/* Mobile filter */}
      <Box sx={{ display: { xs: 'block', lg: 'none' }, mb: 1.5 }}>
        <ResponsiveSelectField
          label="สถานะ"
          size="small"
          value={statusFilter}
          options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(reimbursementStatusLabel).map(([value, label]) => ({ value, label }))]}
          onChange={(value) => setStatusFilter(String(value))}
          sx={{ width: '100%' }}
        />
      </Box>

      {/* Desktop DataGrid */}
      <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
        <AppDataGrid
          rows={filteredReimbursements}
          columns={reimbursementColumns}
          getRowId={(row) => row.id}
          loading={loading}
          getRowHeight={() => 'auto'}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          pageSizeOptions={[10, 20, 50]}
          toolbar={
            <AppDataGridToolbar
              statusOptions={reimbursementStatusOptions}
              selectedStatus={statusFilter}
              onStatusChange={(v) => setStatusFilter(v)}
              searchValue={search}
              onSearchChange={(v) => setSearch(v)}
              searchPlaceholder="ค้นหาคำขอ, ผู้ขอเบิก, เลขออเดอร์, สินค้า…"
            />
          }
        />
      </Box>
      <Stack spacing={1} sx={{ display: { xs: 'flex', lg: 'none' } }}>
        {sortedReimbursements.map((r) => (
          <Card key={r.id} variant="outlined">
            <CardContent sx={{ '&:last-child': { pb: 2 }, py: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Box><Typography sx={{ fontWeight: 700 }}>คำขอ #{r.id}</Typography><Typography variant="body2" color="text.secondary">{r.requestedByUsername} · {new Date(r.requestedAt).toLocaleDateString('th-TH')}</Typography></Box>
                <StatusBadge status={r.status} label={reimbursementStatusLabel[r.status] ?? r.status} />
              </Box>
              <Typography sx={{ mb: 1.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(r.totalAmount)}</Typography>
              <Box sx={{ mb: 1.5 }}>{renderOrderDetails(r)}</Box>
              <Button fullWidth variant="outlined" sx={{ mb: 1, minHeight: 44 }} onClick={() => setAuditTarget(r)}>ตรวจสอบรายละเอียด</Button>
              {canReviewReimbursements && r.status === 'Pending' && <Button fullWidth variant="outlined" disabled={busyId !== null} onClick={() => handleApprove(r.id)} sx={{ minHeight: 44 }}>อนุมัติ</Button>}
              {canReviewReimbursements && r.status === 'Approved' && <Button fullWidth variant="contained" disabled={busyId !== null} onClick={() => handlePay(r.id)} sx={{ minHeight: 44 }}>จ่ายเงิน</Button>}
            </CardContent>
          </Card>
        ))}
        {!loading && reimbursements.length === 0 && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>ไม่มีคำขอเบิกเงิน</Typography>}
      </Stack>
      <Dialog
        open={auditTarget !== null}
        onClose={() => setAuditTarget(null)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { m: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 'calc(100% - 32px)' }, height: { xs: '100dvh', sm: 'auto' }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' }, borderRadius: { xs: 0, sm: 2 } } }}
      >
        <DialogTitle sx={{ pt: { xs: 'calc(16px + env(safe-area-inset-top))', sm: 2 }, px: { xs: 'max(16px, env(safe-area-inset-left))', sm: 3 } }}>ตรวจสอบคำขอ #{auditTarget?.id}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1, px: { xs: 'max(24px, env(safe-area-inset-left))', sm: 3 }, pr: { xs: 'max(24px, env(safe-area-inset-right))', sm: 3 } }}>
          {auditTarget && (
            <>
              <Typography variant="body2">ผู้ขอเบิก: <strong>{auditTarget.requestedByUsername}</strong> · ยอดคำขอ: <strong>{thb.format(auditTarget.totalAmount)}</strong></Typography>
              <Typography variant="body2" color="text.secondary">
                อนุมัติโดย {auditTarget.approvedByUsername ?? '—'}{auditTarget.approvedAt ? ` (${new Date(auditTarget.approvedAt).toLocaleString('th-TH')})` : ''}
                {' · '}จ่ายโดย {auditTarget.paidByUsername ?? '—'}{auditTarget.paidAt ? ` (${new Date(auditTarget.paidAt).toLocaleString('th-TH')})` : ''}
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>ออเดอร์ / รายการสินค้า</TableCell>
                    <TableCell>ผู้จ่าย / วิธีจ่าย</TableCell>
                    <TableCell align="right">ยอดสินค้า</TableCell>
                    <TableCell align="right">จ่ายจริง</TableCell>
                    <TableCell align="right">ยอดเบิกสุทธิ</TableCell>
                    <TableCell align="right">หลักฐาน</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {auditTarget.purchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.platformCode} · {order.platformOrderNo}</Typography>
                          <Box sx={{ mt: 0.5 }}>{renderAuditItems(order)}</Box>
                        </TableCell>
                        <TableCell>{order.paymentPayerUsername ?? '—'} · {order.paymentSource === 'StaffAdvance' ? 'สำรองจ่าย' : order.paymentSource === 'CompanyDirect' ? 'บริษัทจ่ายตรง' : 'ข้อมูลเดิม'}<br /><Typography variant="caption" color="text.secondary">บันทึกโดย {order.paymentRecordedByUsername ?? '—'}</Typography></TableCell>
                        <TableCell align="right">{thb.format(order.orderItemAmount)}</TableCell>
                        <TableCell align="right">
                          <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                            <Typography variant="body2">{order.actualPaidAmount === null ? '—' : thb.format(order.actualPaidAmount)}</Typography>
                            {renderCorrectionButton(auditTarget, order)}
                            {renderAmountCorrections(order, 'right')}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{thb.format(order.reimbursableAmount)}</TableCell>
                        <TableCell align="right">
                          {order.hasPaymentEvidence
                            ? <Button size="small" aria-label={`เปิดหลักฐานการจ่าย Order ${order.platformOrderNo}`} onClick={() => void downloadEvidence(order.id)}>เปิด</Button>
                            : <Typography variant="caption" color="text.secondary">ไม่มี</Typography>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditTarget.purchaseOrders.length === 0 && <TableRow><TableCell colSpan={6} align="center">ไม่พบรายการออเดอร์</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack spacing={1} sx={{ display: { xs: 'flex', lg: 'none' } }}>
                {auditTarget.purchaseOrders.map((order) => (
                  <Paper key={order.id} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {order.platformCode} · {order.platformOrderNo}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>{renderAuditItems(order)}</Box>
                    <Stack spacing={0.25} sx={{ mt: 1.25 }}>
                      <Typography variant="caption" color="text.secondary">ผู้จ่าย / วิธีจ่าย</Typography>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {order.paymentPayerUsername ?? '—'} · {order.paymentSource === 'StaffAdvance' ? 'สำรองจ่าย' : order.paymentSource === 'CompanyDirect' ? 'บริษัทจ่ายตรง' : 'ข้อมูลเดิม'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>บันทึกโดย {order.paymentRecordedByUsername ?? '—'}</Typography>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 0.75, alignItems: 'center', mt: 1.25 }}>
                      <Typography variant="body2" color="text.secondary">ยอดสินค้า</Typography>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{thb.format(order.orderItemAmount)}</Typography>
                      <Typography variant="body2" color="text.secondary">ยอดจ่ายจริง</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{order.actualPaidAmount === null ? '—' : thb.format(order.actualPaidAmount)}</Typography>
                      <Typography variant="body2" color="text.secondary">ยอดเบิกสุทธิ</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(order.reimbursableAmount)}</Typography>
                    </Box>
                    <Box sx={{ mt: 0.75 }}>
                      {renderCorrectionButton(auditTarget, order)}
                      {renderAmountCorrections(order)}
                    </Box>
                    {order.hasPaymentEvidence
                      ? <Button fullWidth variant="outlined" aria-label={`เปิดหลักฐานการจ่าย Order ${order.platformOrderNo}`} onClick={() => void downloadEvidence(order.id)} sx={{ mt: 1, minHeight: 44 }}>เปิดหลักฐานการจ่าย</Button>
                      : <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>ไม่มีหลักฐานการจ่าย</Typography>}
                  </Paper>
                ))}
                {auditTarget.purchaseOrders.length === 0 && (
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>ไม่พบรายการออเดอร์</Typography>
                )}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 }, px: { xs: 'max(8px, env(safe-area-inset-left))', sm: 2 }, pr: { xs: 'max(8px, env(safe-area-inset-right))', sm: 2 } }}><Button onClick={() => setAuditTarget(null)}>ปิด</Button></DialogActions>
      </Dialog>
      <Dialog
        open={editingPayment !== null}
        onClose={() => { if (!savingCorrection) setEditingPayment(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>แก้ยอดจ่ายจริง · {editingPayment?.platformOrderNo}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {auditTarget?.status === 'Approved' && (
            <Alert severity="info">เมื่อบันทึกแล้ว คำขอจะกลับไปรออนุมัติใหม่</Alert>
          )}
          {correctionError && <Alert severity="error">{correctionError}</Alert>}
          <TextField
            autoFocus
            required
            label="ยอดจ่ายจริงใหม่"
            type="number"
            value={paymentAmountDraft}
            onChange={(event) => setPaymentAmountDraft(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
          />
          <TextField
            required
            multiline
            minRows={2}
            label="เหตุผลที่แก้ไข"
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value.slice(0, 500))}
            helperText={`${correctionReason.length}/500`}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={savingCorrection} onClick={() => setEditingPayment(null)}>ยกเลิก</Button>
          <Button variant="contained" disabled={savingCorrection} onClick={() => void handleCorrectPaymentAmount()}>
            {savingCorrection ? 'กำลังบันทึก…' : 'บันทึกยอดใหม่'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { PageHeader } from '../components/PageHeader';
import { BarcodeScannerDialog } from '../components/BarcodeScannerDialog';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import { purchaseOrderStatusLabel } from '../theme/tokens';
import { createOrder, listOrders, markPaid, type CreateOrderItemInput } from '../api/ordersApi';
import { getPaymentPayers, getPlatforms, getProducts } from '../api/masterDataApi';
import type { PaymentPayerResponse, PlatformResponse, ProductResponse, PurchaseOrderResponse } from '../types/models';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function OrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderResponse[]>([]);
  const [platforms, setPlatforms] = useState<PlatformResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [users, setUsers] = useState<PaymentPayerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderScannerOpen, setOrderScannerOpen] = useState(false);
  const [formPlatformId, setFormPlatformId] = useState<number | ''>('');
  const [formOrderNo, setFormOrderNo] = useState('');
  const [formItems, setFormItems] = useState<CreateOrderItemInput[]>([{ productId: 0, qty: 1, unitPrice: 0 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PurchaseOrderResponse | null>(null);
  const [paymentSource, setPaymentSource] = useState<'StaffAdvance' | 'CompanyDirect'>('StaffAdvance');
  const [actualPaidAmount, setActualPaidAmount] = useState('0');
  const [paymentPayerUserId, setPaymentPayerUserId] = useState<number | ''>('');
  const [paymentEvidence, setPaymentEvidence] = useState<File | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const busyOrdersRef = useRef(new Set<number>());
  const [busyOrders, setBusyOrders] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, platformsData, productsData, usersData] = await Promise.all([
        listOrders({ status: statusFilter || undefined, search: search || undefined }),
        getPlatforms(),
        getProducts(),
        getPaymentPayers(),
      ]);
      setOrders(ordersData);
      setPlatforms(platformsData);
      setProducts(productsData);
      setUsers(usersData);
    } catch {
      setError('โหลดรายการออเดอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = () => load();

  const openDialog = () => {
    setFormPlatformId(platforms[0]?.id ?? '');
    setFormOrderNo('');
    setFormItems([{ productId: products[0]?.id ?? 0, qty: 1, unitPrice: 0 }]);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleOrderNoDetected = useCallback((code: string) => {
    setFormOrderNo(code.trim());
    setFormError(null);
    setOrderScannerOpen(false);
  }, []);

  const updateItem = (index: number, patch: Partial<CreateOrderItemInput>) => {
    setFormItems((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => setFormItems((items) => [...items, { productId: products[0]?.id ?? 0, qty: 1, unitPrice: 0 }]);
  const removeItem = (index: number) => setFormItems((items) => items.filter((_, i) => i !== index));

  const handleCreate = async () => {
    if (formPlatformId === '' || !formOrderNo.trim() || formItems.some((i) => !i.productId || i.qty <= 0 || i.unitPrice < 0)) {
      setFormError('กรอกข้อมูลให้ครบและถูกต้อง');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createOrder({ platformId: formPlatformId, platformOrderNo: formOrderNo.trim(), items: formItems });
      setDialogOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'สร้างออเดอร์ไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentDialog = (order: PurchaseOrderResponse) => {
    setPaymentTarget(order);
    setPaymentSource('StaffAdvance');
    setActualPaidAmount(String(order.totalAmount));
    setPaymentPayerUserId(order.orderedByUserId);
    setPaymentEvidence(null);
    setPaymentError(null);
  };

  const handleMarkPaid = async () => {
    if (!paymentTarget || paymentPayerUserId === '') return;
    const id = paymentTarget.id;
    if (busyOrdersRef.current.has(id)) return;
    if (actualPaidAmount.trim() === '' || !Number.isFinite(Number(actualPaidAmount)) || Number(actualPaidAmount) < 0) {
      setPaymentError('กรอกยอดจ่ายจริงเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป');
      return;
    }
    busyOrdersRef.current.add(id);
    setBusyOrders(new Set(busyOrdersRef.current));
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      await markPaid(id, {
        paymentSource,
        actualPaidAmount: Number(actualPaidAmount),
        paymentPayerUserId,
        evidence: paymentEvidence ?? undefined,
      });
      setPaymentTarget(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPaymentError(msg ?? 'บันทึกการจ่ายเงินไม่สำเร็จ');
    } finally {
      busyOrdersRef.current.delete(id);
      setBusyOrders(new Set(busyOrdersRef.current));
      setPaymentSubmitting(false);
    }
  };

  const total = formItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

  return (
    <>
      <PageHeader
        title="รายการออเดอร์"
        subtitle="กรองสถานะหรือค้นหาเลขออเดอร์"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>สั่งของใหม่</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดออเดอร์" sx={{ mb: 2 }} />}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', '& > .MuiFormControl-root': { flex: { xs: '1 1 100%', sm: '0 1 220px' } } }}>
        <ResponsiveSelectField
          label="สถานะ"
          size="small"
          value={statusFilter}
          options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(purchaseOrderStatusLabel).map(([value, label]) => ({ value, label }))]}
          onChange={(value) => setStatusFilter(String(value))}
        />
        <TextField
          label="ค้นหาเลขออเดอร์"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outlined" onClick={handleSearch} sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 44 }}>ค้นหา</Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>แพลตฟอร์ม</TableCell>
              <TableCell>เลขออเดอร์</TableCell>
              <TableCell>ผู้สั่ง</TableCell>
              <TableCell align="right">ยอดสินค้า / จ่ายจริง</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>วันที่สั่ง</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell>{o.platformCode}</TableCell>
                <TableCell>{o.platformOrderNo}</TableCell>
                <TableCell>{o.orderedByUsername}</TableCell>
                <TableCell align="right">{thb.format(o.actualPaidAmount ?? o.totalAmount)}</TableCell>
                <TableCell><StatusBadge status={o.status} label={purchaseOrderStatusLabel[o.status] ?? o.status} /></TableCell>
                <TableCell>{new Date(o.orderedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {o.status === 'Ordered' && (
                    <Button size="small" disabled={busyOrders.has(o.id)} onClick={() => openPaymentDialog(o)}>บันทึกการจ่าย</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && orders.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center">ไม่มีออเดอร์</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1.5 }}>
        {orders.map((o) => (
          <Paper key={o.id} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{o.platformOrderNo}</Typography>
                <Typography variant="body2" color="text.secondary">{o.platformCode} · {o.orderedByUsername}</Typography>
              </Box>
              <StatusBadge status={o.status} label={purchaseOrderStatusLabel[o.status] ?? o.status} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">ยอดสินค้า / จ่ายจริง</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(o.actualPaidAmount ?? o.totalAmount)}</Typography>
              <Typography variant="body2" color="text.secondary">วันที่สั่ง</Typography>
              <Typography variant="body2">{new Date(o.orderedAt).toLocaleDateString('th-TH')}</Typography>
            </Box>
            {o.status === 'Ordered' && (
              <Button fullWidth variant="outlined" disabled={busyOrders.has(o.id)} sx={{ mt: 2, minHeight: 44 }} onClick={() => openPaymentDialog(o)}>{busyOrders.has(o.id) ? 'กำลังบันทึก…' : 'บันทึกการจ่าย'}</Button>
            )}
          </Paper>
        ))}
        {!loading && orders.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>ไม่มีออเดอร์</Paper>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 'calc(100% - 32px)' }, height: { xs: '100dvh', sm: 'auto' }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' }, borderRadius: { xs: 0, sm: 2 } } }}>
        <DialogTitle>สั่งของใหม่</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <ResponsiveSelectField
            label="แพลตฟอร์ม"
            value={formPlatformId}
            options={platforms.map((platform) => ({ value: platform.id, label: platform.name }))}
            onChange={(value) => setFormPlatformId(Number(value))}
            sx={{
              mt: 3,
              '& .MuiInputLabel-root.MuiInputLabel-shrink': { transform: 'translate(14px, -24px) scale(0.75)' },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="เลขออเดอร์ (จากแอพ)"
              value={formOrderNo}
              onChange={(e) => setFormOrderNo(e.target.value)}
            />
            <Button
              variant="outlined"
              startIcon={<CameraAltIcon />}
              onClick={() => setOrderScannerOpen(true)}
              sx={{ minHeight: 56, flexShrink: 0 }}
            >
              สแกน
            </Button>
          </Box>

          <Typography variant="subtitle2">รายการสินค้า</Typography>
          {formItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1, alignItems: 'center', border: { xs: '1px solid', sm: 0 }, borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, sm: 0 } }}>
              <ResponsiveSelectField
                label="สินค้า"
                size="small"
                value={item.productId || ''}
                options={products.map((product) => ({ value: product.id, label: product.name }))}
                onChange={(value) => updateItem(idx, { productId: Number(value) })}
                sx={{ flex: { xs: '1 1 100%', sm: 2 } }}
              />
              <TextField label="จำนวน" size="small" type="number" value={item.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} sx={{ flex: 1, minWidth: 0 }} />
              <TextField label="ราคา/ชิ้น" size="small" type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} sx={{ flex: 1, minWidth: 0 }} />
              <IconButton size="small" aria-label={`ลบรายการสินค้า ${idx + 1}`} onClick={() => removeItem(idx)} disabled={formItems.length === 1} sx={{ minWidth: 44, minHeight: 44 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addItem} sx={{ alignSelf: 'flex-start' }}>เพิ่มรายการ</Button>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>ยอดรวม: {thb.format(total)}</Typography>
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleCreate} disabled={submitting}>บันทึก</Button>
        </DialogActions>
      </Dialog>
      <BarcodeScannerDialog
        open={orderScannerOpen}
        title="สแกนเลขออเดอร์"
        onClose={() => setOrderScannerOpen(false)}
        onDetected={handleOrderNoDetected}
      />
      <Dialog open={paymentTarget !== null} onClose={() => !paymentSubmitting && setPaymentTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>บันทึกการจ่าย — {paymentTarget?.platformOrderNo}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {paymentError && <Alert severity="error">{paymentError}</Alert>}
          <ResponsiveSelectField
            label="วิธีจ่ายเงิน"
            value={paymentSource}
            options={[{ value: 'StaffAdvance', label: 'พนักงานสำรองจ่าย — ขอเบิกคืนได้' }, { value: 'CompanyDirect', label: 'บริษัท/เจ้านายจ่ายตรง — ไม่เข้าเบิกพนักงาน' }]}
            onChange={(value) => {
              const next = String(value) as 'StaffAdvance' | 'CompanyDirect';
              setPaymentSource(next);
              if (next === 'StaffAdvance' && paymentTarget) setPaymentPayerUserId(paymentTarget.orderedByUserId);
              if (next === 'CompanyDirect' && paymentPayerUserId === paymentTarget?.orderedByUserId) {
                setPaymentPayerUserId(users.find((u) => u.role === 'admin')?.id ?? users[0]?.id ?? '');
              }
            }}
          />
          <TextField
            label="ยอดจ่ายจริง (รวมส่วนลด/ค่าส่ง)"
            type="number"
            slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
            value={actualPaidAmount}
            onChange={(e) => setActualPaidAmount(e.target.value)}
          />
          <ResponsiveSelectField
            label={paymentSource === 'StaffAdvance' ? 'ผู้สำรองจ่าย/ผู้ขอเบิก' : 'ผู้จ่ายเงินจริง'}
            value={paymentPayerUserId}
            disabled={paymentSource === 'StaffAdvance'}
            options={users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
            onChange={(value) => setPaymentPayerUserId(Number(value))}
          />
          <Box>
            <Button component="label" variant="outlined" sx={{ minHeight: 44 }}>
              แนบหลักฐาน (ไม่บังคับ)
              <input hidden type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setPaymentEvidence(e.target.files?.[0] ?? null)} />
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {paymentEvidence ? paymentEvidence.name : 'รองรับ JPG, PNG หรือ PDF ไม่เกิน 5 MB'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setPaymentTarget(null)} disabled={paymentSubmitting}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleMarkPaid} disabled={paymentSubmitting || paymentPayerUserId === ''}>
            {paymentSubmitting ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

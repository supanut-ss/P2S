import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { PageHeader } from '../components/PageHeader';
import { BarcodeScannerDialog } from '../components/BarcodeScannerDialog';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import { purchaseOrderStatusLabel } from '../theme/tokens';
import { createOrder, listOrders, markPaid, type CreateOrderItemInput } from '../api/ordersApi';
import { getPaymentPayers, getPlatforms, getProducts } from '../api/masterDataApi';
import type { PaymentPayerResponse, PaymentSource, PlatformResponse, ProductResponse, PurchaseOrderResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

function receiptDateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString('th-TH') : 'ยังไม่รับของ';
}

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrderResponse[]>([]);
  const [platforms, setPlatforms] = useState<PlatformResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [users, setUsers] = useState<PaymentPayerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderScannerOpen, setOrderScannerOpen] = useState(false);
  const [formPlatformId, setFormPlatformId] = useState<number | ''>('');
  const [formOrderNo, setFormOrderNo] = useState('');
  const [formItems, setFormItems] = useState<CreateOrderItemInput[]>([{ productId: 0, qty: 1, unitPrice: 0 }]);
  const [formPaymentSource, setFormPaymentSource] = useState<PaymentSource>('StaffAdvance');
  const [formPaymentPayerUserId, setFormPaymentPayerUserId] = useState<number | ''>('');
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
    setFormPaymentSource('StaffAdvance');
    setFormPaymentPayerUserId(users.find((u) => u.role === 'admin')?.id ?? users[0]?.id ?? '');
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
  const toggleOrderDetails = (orderId: number) => setExpandedOrders((current) => {
    const next = new Set(current);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    return next;
  });

  const handleCreate = async () => {
    if (
      formPlatformId === '' || !formOrderNo.trim() ||
      (formPaymentSource === 'CompanyDirect' && formPaymentPayerUserId === '') ||
      formItems.some((i) => !i.productId || i.qty <= 0 || i.unitPrice < 0)
    ) {
      setFormError('กรอกข้อมูลให้ครบและถูกต้อง');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createOrder({
        platformId: formPlatformId,
        platformOrderNo: formOrderNo.trim(),
        plannedPaymentSource: formPaymentSource,
        plannedPaymentPayerUserId: formPaymentSource === 'CompanyDirect' && formPaymentPayerUserId !== ''
          ? formPaymentPayerUserId
          : undefined,
        items: formItems,
      });
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
    setPaymentSource(order.plannedPaymentSource ?? order.paymentSource ?? 'StaffAdvance');
    setActualPaidAmount(String(order.totalAmount));
    setPaymentPayerUserId(order.plannedPaymentPayerUserId ?? order.paymentPayerUserId ?? order.orderedByUserId);
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
              <TableCell>แผนการจ่าย</TableCell>
              <TableCell align="right">ยอดสินค้า / จ่ายจริง</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>วันที่สั่ง</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((o) => (
              <Fragment key={o.id}>
              <TableRow hover>
                <TableCell>{o.platformCode}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.platformOrderNo}</Typography>
                  <Button
                    size="small"
                    aria-expanded={expandedOrders.has(o.id)}
                    aria-controls={`order-items-${o.id}`}
                    onClick={() => toggleOrderDetails(o.id)}
                    startIcon={expandedOrders.has(o.id) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    sx={{ minHeight: 44, px: 0.5 }}
                  >
                    {expandedOrders.has(o.id) ? 'ซ่อนรายการ' : `รายการสินค้า (${o.items.length})`}
                  </Button>
                </TableCell>
                <TableCell>{o.orderedByUsername}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(o.plannedPaymentSource ?? o.paymentSource) === 'CompanyDirect' ? 'เจ้าของ/บริษัทจ่ายตรง' : 'พนักงานสำรองจ่าย'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {o.plannedPaymentPayerUsername ?? o.paymentPayerUsername ?? o.orderedByUsername}
                  </Typography>
                </TableCell>
                <TableCell align="right">{thb.format(o.actualPaidAmount ?? o.totalAmount)}</TableCell>
                <TableCell><StatusBadge status={o.status} label={purchaseOrderStatusLabel[o.status] ?? o.status} /></TableCell>
                <TableCell>{new Date(o.orderedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {o.status === 'Ordered' && (
                    <Button size="small" disabled={busyOrders.has(o.id)} onClick={() => openPaymentDialog(o)}>บันทึกการจ่าย</Button>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={8} sx={{ p: 0, borderBottom: expandedOrders.has(o.id) ? undefined : 0 }}>
                  <Collapse in={expandedOrders.has(o.id)} timeout="auto" unmountOnExit id={`order-items-${o.id}`}>
                    <TableContainer component={Paper} variant="outlined" sx={{ m: 1, width: 'calc(100% - 16px)', overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 980 }} aria-label={`รายการสินค้า Order ${o.platformOrderNo}`}>
                        <TableHead>
                          <TableRow>
                            <TableCell>สินค้า</TableCell>
                            <TableCell>ชื่อหน้ากล่อง</TableCell>
                            <TableCell>รุ่น</TableCell>
                            <TableCell>ร้าน</TableCell>
                            <TableCell>TRACKING</TableCell>
                            <TableCell>วันที่รับของ</TableCell>
                            <TableCell>รายละเอียด</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {o.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.packageName || '—'}</TableCell>
                              <TableCell>{item.model || '—'}</TableCell>
                              <TableCell>{item.shopName || '—'}</TableCell>
                              <TableCell>
                                {item.trackingNo || 'รอข้อมูลจากระบบ'}
                                {item.courier ? ` · ${item.courier}` : ''}
                              </TableCell>
                              <TableCell>{receiptDateLabel(item.arrivedAt)}</TableCell>
                              <TableCell sx={{ minWidth: 180, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.description || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </TableCell>
              </TableRow>
              </Fragment>
            ))}
            {!loading && orders.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center">ไม่มีออเดอร์</TableCell></TableRow>
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
              <Button
                size="small"
                aria-expanded={expandedOrders.has(o.id)}
                aria-controls={`order-items-mobile-${o.id}`}
                onClick={() => toggleOrderDetails(o.id)}
                startIcon={expandedOrders.has(o.id) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                sx={{ minHeight: 44, px: 0.5, mt: 0.25 }}
              >
                {expandedOrders.has(o.id) ? 'ซ่อนรายการสินค้า' : `รายการสินค้า (${o.items.length})`}
              </Button>
              </Box>
              <StatusBadge status={o.status} label={purchaseOrderStatusLabel[o.status] ?? o.status} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">ยอดสินค้า / จ่ายจริง</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{thb.format(o.actualPaidAmount ?? o.totalAmount)}</Typography>
              <Typography variant="body2" color="text.secondary">แผนการจ่าย</Typography>
              <Typography variant="body2">
                {(o.plannedPaymentSource ?? o.paymentSource) === 'CompanyDirect' ? 'เจ้าของ/บริษัทจ่ายตรง' : 'พนักงานสำรองจ่าย'}
                {' · '}{o.plannedPaymentPayerUsername ?? o.paymentPayerUsername ?? o.orderedByUsername}
              </Typography>
              <Typography variant="body2" color="text.secondary">วันที่สั่ง</Typography>
              <Typography variant="body2">{new Date(o.orderedAt).toLocaleDateString('th-TH')}</Typography>
            </Box>
            <Collapse in={expandedOrders.has(o.id)} timeout="auto" unmountOnExit id={`order-items-mobile-${o.id}`}>
              <Box sx={{ display: 'grid', gap: 1, mt: 2 }}>
                {o.items.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(92px, auto) minmax(0, 1fr)', gap: 0.75, mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">ชื่อหน้ากล่อง</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.packageName || '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">รุ่น</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.model || '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">ร้าน</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.shopName || '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">TRACKING</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.trackingNo || 'รอข้อมูลจากระบบ'}{item.courier ? ` · ${item.courier}` : ''}</Typography>
                      <Typography variant="body2" color="text.secondary">วันที่รับของ</Typography><Typography variant="body2">{receiptDateLabel(item.arrivedAt)}</Typography>
                      <Typography variant="body2" color="text.secondary">รายละเอียด</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.description || '—'}</Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Collapse>
            {o.status === 'Ordered' && (
              <Button fullWidth variant="outlined" disabled={busyOrders.has(o.id)} sx={{ mt: 2, minHeight: 44 }} onClick={() => openPaymentDialog(o)}>{busyOrders.has(o.id) ? 'กำลังบันทึก…' : 'บันทึกการจ่าย'}</Button>
            )}
          </Paper>
        ))}
        {!loading && orders.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>ไม่มีออเดอร์</Paper>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 'calc(100% - 32px)' }, height: { xs: '100dvh', sm: 'auto' }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' }, borderRadius: { xs: 0, sm: 2 } } }}>
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

          <ResponsiveSelectField
            label="ใครเป็นผู้จ่ายเงิน"
            value={formPaymentSource}
            options={[
              { value: 'StaffAdvance', label: 'พนักงานออกเงินเอง — ขอเบิกคืนได้' },
              { value: 'CompanyDirect', label: 'เจ้าของ/บริษัทจ่ายตรง — ไม่สามารถเบิกคืน' },
            ]}
            onChange={(value) => {
              const next = String(value) as PaymentSource;
              setFormPaymentSource(next);
              if (next === 'CompanyDirect' && formPaymentPayerUserId === '') {
                setFormPaymentPayerUserId(users.find((u) => u.role === 'admin')?.id ?? users[0]?.id ?? '');
              }
            }}
          />
          {formPaymentSource === 'StaffAdvance' ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              ระบบจะบันทึกผู้สั่งออเดอร์ ({user?.username ?? 'คุณ'}) เป็นผู้สำรองจ่ายและผู้ขอเบิก
            </Typography>
          ) : (
            <ResponsiveSelectField
              label="เจ้าของ/บริษัทผู้จ่าย"
              value={formPaymentPayerUserId}
              options={users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
              onChange={(value) => setFormPaymentPayerUserId(Number(value))}
            />
          )}

          <Typography variant="subtitle2">รายการสินค้า</Typography>
          {formItems.map((item, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <ResponsiveSelectField
                  label="สินค้า"
                  value={item.productId || ''}
                  options={products.map((product) => ({ value: product.id, label: product.name }))}
                  onChange={(value) => updateItem(idx, { productId: Number(value) })}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <IconButton aria-label={`ลบรายการสินค้า ${idx + 1}`} onClick={() => removeItem(idx)} disabled={formItems.length === 1} sx={{ minWidth: 48, minHeight: 48 }}>
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25, mt: 1.25 }}>
                <TextField fullWidth label="ชื่อหน้ากล่อง" value={item.packageName ?? ''} onChange={(e) => updateItem(idx, { packageName: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <TextField fullWidth label="รุ่น" value={item.model ?? ''} onChange={(e) => updateItem(idx, { model: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <TextField fullWidth label="ร้าน" value={item.shopName ?? ''} onChange={(e) => updateItem(idx, { shopName: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <TextField fullWidth label="รายละเอียดเพิ่มเติม" multiline minRows={2} value={item.description ?? ''} onChange={(e) => updateItem(idx, { description: e.target.value })} helperText="ยี่ห้อ รุ่น หรือรายละเอียดอื่น ๆ" slotProps={{ htmlInput: { maxLength: 1000 } }} sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }} />
                <TextField fullWidth label="จำนวน" type="number" value={item.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} slotProps={{ htmlInput: { min: 1, step: 1, inputMode: 'numeric' } }} />
                <TextField fullWidth label="ราคา/ชิ้น" type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} slotProps={{ htmlInput: { min: 0, step: '0.01', inputMode: 'decimal' } }} />
              </Box>
            </Paper>
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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { PageHeader } from '../components/PageHeader';
import { BarcodeScannerDialog } from '../components/BarcodeScannerDialog';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import { StatusBadge } from '../components/StatusBadge';
import { purchaseOrderStatusLabel } from '../theme/tokens';
import { createOrder, listOrders, markPaid, setTracking, type CreateOrderItemInput } from '../api/ordersApi';
import { getPaymentPayers, getPlatforms, getProducts } from '../api/masterDataApi';
import type { PaymentPayerResponse, PaymentSource, PlatformResponse, ProductResponse, PurchaseOrderResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
type OrderSortField = 'platform' | 'orderNo' | 'date' | 'status' | 'item' | 'orderedBy' | 'paymentPlan' | 'price';
type SortDirection = 'asc' | 'desc';

function receiptDateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString('th-TH') : 'ยังไม่รับของ';
}

function localDayBoundary(value: string, dayOffset = 0) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day + dayOffset).getTime();
}

function filterOrderItems(order: PurchaseOrderResponse, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('th-TH');
  if (!normalizedQuery) return order.items;
  const orderMetadata = [order.packageName, order.shopName, order.trackingNo, order.courier]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('th-TH');
  if (orderMetadata.includes(normalizedQuery)) return order.items;

  return order.items.filter((item) => [
    item.productName,
    item.model,
    item.description,
  ].filter(Boolean).join(' ').toLocaleLowerCase('th-TH').includes(normalizedQuery));
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [sortField, setSortField] = useState<OrderSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderScannerOpen, setOrderScannerOpen] = useState(false);
  const [formPlatformId, setFormPlatformId] = useState<number | ''>('');
  const [formOrderNo, setFormOrderNo] = useState('');
  const [formPackageName, setFormPackageName] = useState('');
  const [formShopName, setFormShopName] = useState('');
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
  const [trackingTarget, setTrackingTarget] = useState<PurchaseOrderResponse | null>(null);
  const [trackingNo, setTrackingNo] = useState('');
  const [trackingCourier, setTrackingCourier] = useState('');
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingSaving, setTrackingSaving] = useState(false);
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
    setFormPackageName('');
    setFormShopName('');
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

  const handleSort = (field: OrderSortField) => {
    if (sortField === field) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortField(field);
  };

  const sortLabel = (field: OrderSortField, label: string) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDirection : 'asc'}
      onClick={() => handleSort(field)}
    >
      {label}
    </TableSortLabel>
  );

  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const filteredOrders = useMemo(() => {
    if (invalidDateRange) return [];
    const startTime = dateFrom ? localDayBoundary(dateFrom) : null;
    const endTime = dateTo ? localDayBoundary(dateTo, 1) : null;
    const filtered = orders.filter((order) => {
      const orderedAt = new Date(order.orderedAt).getTime();
      if (startTime !== null && orderedAt < startTime) return false;
      if (endTime !== null && orderedAt >= endTime) return false;
      return filterOrderItems(order, itemFilter).length > 0;
    });

    const valueFor = (order: PurchaseOrderResponse): string | number => {
      if (sortField === 'platform') return order.platformCode;
      if (sortField === 'orderNo') return order.platformOrderNo;
      if (sortField === 'date') return new Date(order.orderedAt).getTime();
      if (sortField === 'status') return purchaseOrderStatusLabel[order.status] ?? order.status;
      if (sortField === 'item') return filterOrderItems(order, itemFilter).map((item) => item.productName).sort((a, b) => a.localeCompare(b, 'th')).join(' / ');
      if (sortField === 'orderedBy') return order.orderedByUsername;
      if (sortField === 'paymentPlan') return (order.plannedPaymentSource ?? order.paymentSource) === 'CompanyDirect' ? 'เจ้าของ/บริษัทจ่ายตรง' : 'พนักงานสำรองจ่าย';
      return order.actualPaidAmount ?? order.totalAmount;
    };

    const multiplier = sortDirection === 'asc' ? 1 : -1;
    return filtered.sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), 'th');
      if (comparison !== 0) return comparison * multiplier;
      return new Date(right.orderedAt).getTime() - new Date(left.orderedAt).getTime();
    });
  }, [dateFrom, dateTo, invalidDateRange, itemFilter, orders, sortDirection, sortField]);

  const exportRowCount = filteredOrders.reduce((count, order) => count + filterOrderItems(order, itemFilter).length, 0);

  const handleExportExcel = async () => {
    if (exportRowCount === 0 || invalidDateRange || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const XLSX = await import('xlsx');
      const rows = filteredOrders.flatMap((order) => filterOrderItems(order, itemFilter).map((item) => ({
        'วันที่สั่ง': new Date(order.orderedAt),
        'แพลตฟอร์ม': order.platformCode,
        'เลข Order': order.platformOrderNo,
        'สถานะ': purchaseOrderStatusLabel[order.status] ?? order.status,
        'ผู้สั่ง': order.orderedByUsername,
        'สินค้า': item.productName,
        'ชื่อหน้ากล่อง': order.packageName ?? '',
        'รุ่น': item.model ?? '',
        'ร้าน': order.shopName ?? '',
        'รายละเอียด': item.description ?? '',
        'จำนวน': item.qty,
        'ราคาต่อชิ้น': item.unitPrice,
        'รวมรายการ': item.qty * item.unitPrice,
        'ยอด Order': order.actualPaidAmount ?? order.totalAmount,
        'TRACKING': order.trackingNo ?? '',
        'COURIER': order.courier ?? '',
        'วันที่รับของ': item.arrivedAt ? new Date(item.arrivedAt) : null,
      })));
      const worksheet = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: 'dd/mm/yyyy hh:mm' });
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 28 },
        { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 36 }, { wch: 10 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 16 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
      const now = new Date();
      const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      XLSX.writeFile(workbook, `orders-${dateStamp}.xlsx`, { compression: true });
    } catch {
      setExportError('ส่งออก Excel ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setExporting(false);
    }
  };

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
        packageName: formPackageName.trim() || undefined,
        shopName: formShopName.trim() || undefined,
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

  const openTrackingDialog = (order: PurchaseOrderResponse) => {
    setTrackingTarget(order);
    setTrackingNo(order.trackingNo ?? '');
    setTrackingCourier(order.courier ?? '');
    setTrackingError(null);
  };

  const handleSetTracking = async () => {
    if (!trackingTarget || trackingSaving) return;
    const target = trackingTarget;
    const nextTrackingNo = trackingNo.trim();
    const nextCourier = trackingCourier.trim();
    setTrackingSaving(true);
    setTrackingError(null);
    try {
      await setTracking(target.id, nextTrackingNo || null, nextCourier || null);
      setOrders((current) => current.map((order) => order.id === target.id
        ? { ...order, trackingNo: nextTrackingNo || null, courier: nextCourier || null }
        : order));
      setTrackingTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setTrackingError(msg ?? 'บันทึกข้อมูล Tracking ไม่สำเร็จ');
    } finally {
      setTrackingSaving(false);
    }
  };

  const total = formItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

  return (
    <>
      <PageHeader
        title="รายการออเดอร์"
        subtitle="ค้นหา กรอง และจัดเรียงรายการออเดอร์ พร้อมส่งออก Excel"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>สั่งของใหม่</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {exportError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>{exportError}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดออเดอร์" sx={{ mb: 2 }} />}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 2, alignItems: 'start' }}>
        <ResponsiveSelectField
          label="สถานะ"
          value={statusFilter}
          options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(purchaseOrderStatusLabel).map(([value, label]) => ({ value, label }))]}
          onChange={(value) => setStatusFilter(String(value))}
        />
        <TextField
          label="ค้นหาเลขออเดอร์"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <TextField
          label="วันที่สั่งตั้งแต่"
          type="date"
          fullWidth
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'วันที่สั่งตั้งแต่' } }}
        />
        <TextField
          label="ถึงวันที่"
          type="date"
          fullWidth
          error={invalidDateRange}
          helperText={invalidDateRange ? 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น' : ' '}
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'วันที่สั่งถึง' } }}
        />
        <TextField
          label="กรองสินค้า / Item"
          placeholder="ชื่อสินค้า รุ่น ร้าน หรือรายละเอียด"
          fullWidth
          value={itemFilter}
          onChange={(event) => setItemFilter(event.target.value)}
        />
        <Box sx={{ display: { xs: 'grid', lg: 'none' }, gridColumn: { xs: 'auto', sm: '1 / -1' }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          <ResponsiveSelectField
            label="เรียงตาม"
            value={sortField}
            options={[
              { value: 'date', label: 'วันที่สั่ง' },
              { value: 'status', label: 'สถานะ' },
              { value: 'item', label: 'สินค้า / Item' },
              { value: 'price', label: 'ยอด Order / จ่ายจริง' },
            ]}
            onChange={(value) => setSortField(String(value) as OrderSortField)}
          />
          <ResponsiveSelectField
            label="ลำดับ"
            value={sortDirection}
            options={[
              { value: 'desc', label: 'ใหม่ / มาก / ฮ-ก ก่อน' },
              { value: 'asc', label: 'เก่า / น้อย / ก-ฮ ก่อน' },
            ]}
            onChange={(value) => setSortDirection(String(value) as SortDirection)}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, gridColumn: { xs: 'auto', sm: '1 / -1' }, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={handleSearch} sx={{ minHeight: 48, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>ค้นหา Order</Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={() => void handleExportExcel()}
            disabled={loading || exporting || exportRowCount === 0 || invalidDateRange}
            sx={{ minHeight: 48, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          >
            {exporting ? 'กำลังเตรียม Excel…' : `Export Excel (${exportRowCount})`}
          </Button>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }} aria-live="polite">
        แสดง {filteredOrders.length} Order · {exportRowCount} รายการสินค้า
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Table
          size="small"
          sx={{
            minWidth: 1300,
            tableLayout: 'fixed',
            '& .MuiTableBody-root > .MuiTableRow-root > .MuiTableCell-root': { verticalAlign: 'top' },
          }}
        >
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sortField === 'platform' ? sortDirection : false}>
                {sortLabel('platform', 'แพลตฟอร์ม')}
              </TableCell>
              <TableCell sortDirection={sortField === 'orderNo' ? sortDirection : false}>
                {sortLabel('orderNo', 'เลข Order')}
              </TableCell>
              <TableCell sortDirection={sortField === 'item' ? sortDirection : false}>
                {sortLabel('item', 'สินค้า / Item')}
              </TableCell>
              <TableCell sortDirection={sortField === 'orderedBy' ? sortDirection : false}>
                {sortLabel('orderedBy', 'ผู้สั่ง')}
              </TableCell>
              <TableCell sortDirection={sortField === 'paymentPlan' ? sortDirection : false}>
                {sortLabel('paymentPlan', 'แผนการจ่าย')}
              </TableCell>
              <TableCell align="right" sortDirection={sortField === 'price' ? sortDirection : false}>
                {sortLabel('price', 'ยอดสินค้า / จ่ายจริง')}
              </TableCell>
              <TableCell sortDirection={sortField === 'status' ? sortDirection : false}>
                {sortLabel('status', 'สถานะ')}
              </TableCell>
              <TableCell sortDirection={sortField === 'date' ? sortDirection : false}>
                {sortLabel('date', 'วันที่สั่ง')}
              </TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((o) => {
              const visibleItems = filterOrderItems(o, itemFilter);
              return (
                <Fragment key={o.id}>
              <TableRow hover>
                <TableCell>{o.platformCode}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.platformOrderNo}</Typography>

                  {(o.packageName || o.shopName) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 240, overflowWrap: "anywhere" }}>
                      {o.packageName && <>หน้ากล่อง {o.packageName}</>}
                      {o.packageName && o.shopName && " · "}
                      {o.shopName && <>ร้าน {o.shopName}</>}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                      Tracking {o.trackingNo || 'ยังไม่ระบุ'}{o.courier ? ` · ${o.courier}` : ''}
                    </Typography>
                    <Button size="small" onClick={() => openTrackingDialog(o)} aria-label={`แก้ไข Tracking ของ Order ${o.platformOrderNo}`} sx={{ minWidth: 44, minHeight: 32, px: 0.5, flexShrink: 0 }}>
                      แก้ไข
                    </Button>
                  </Box>
                  <Button
                    size="small"
                    aria-expanded={expandedOrders.has(o.id)}
                    aria-controls={`order-items-${o.id}`}
                    onClick={() => toggleOrderDetails(o.id)}
                    startIcon={expandedOrders.has(o.id) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    sx={{ minHeight: 32, px: 0.5 }}
                  >
                    {expandedOrders.has(o.id) ? 'ซ่อนรายการ' : `รายการสินค้า (${o.items.length})`}
                  </Button>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {visibleItems[0]?.productName ?? '—'}
                  </Typography>
                  {visibleItems.length > 1 && (
                    <Typography variant="caption" color="text.secondary">
                      อีก {visibleItems.length - 1} รายการ
                    </Typography>
                  )}
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
                <TableCell colSpan={9} sx={{ p: 0, borderBottom: expandedOrders.has(o.id) ? undefined : 0 }}>
                  <Collapse in={expandedOrders.has(o.id)} timeout="auto" unmountOnExit id={`order-items-${o.id}`}>
                    <TableContainer component={Paper} variant="outlined" sx={{ m: 1, width: 'calc(100% - 16px)', overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 680 }} aria-label={`รายการสินค้า Order ${o.platformOrderNo}`}>
                        <TableHead>
                          <TableRow>
                            <TableCell>สินค้า</TableCell>
                            <TableCell>รุ่น</TableCell>
                            <TableCell>วันที่รับของ</TableCell>
                            <TableCell>รายละเอียด</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filterOrderItems(o, itemFilter).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.model || '—'}</TableCell>
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
              );
            })}
            {!loading && filteredOrders.length === 0 && (
              <TableRow><TableCell colSpan={9} align="center">ไม่มีออเดอร์</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1.5 }}>
        {filteredOrders.map((o) => (
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
              <Typography variant="body2" color="text.secondary">Tracking</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>{o.trackingNo || 'ยังไม่ระบุ'}{o.courier ? ` · ${o.courier}` : ''}</Typography>
                <Button size="small" onClick={() => openTrackingDialog(o)} aria-label={`แก้ไข Tracking ของ Order ${o.platformOrderNo}`} sx={{ minWidth: 44, minHeight: 44, px: 0.5, flexShrink: 0 }}>แก้ไข</Button>
              </Box>
              {(o.packageName || o.shopName) && (<>
                <Typography variant="body2" color="text.secondary">ชื่อหน้ากล่อง</Typography><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{o.packageName || "—"}</Typography>
                <Typography variant="body2" color="text.secondary">ร้าน</Typography><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{o.shopName || "—"}</Typography>
              </>)}
            </Box>
            <Collapse in={expandedOrders.has(o.id)} timeout="auto" unmountOnExit id={`order-items-mobile-${o.id}`}>
              <Box sx={{ display: 'grid', gap: 1, mt: 2 }}>
                {filterOrderItems(o, itemFilter).map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(92px, auto) minmax(0, 1fr)', gap: 0.75, mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">รุ่น</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.model || '—'}</Typography>
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
        {!loading && filteredOrders.length === 0 && (
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

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
            <TextField fullWidth label="ชื่อหน้ากล่อง" value={formPackageName} onChange={(e) => setFormPackageName(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField fullWidth label="ร้าน" value={formShopName} onChange={(e) => setFormShopName(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
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
                <TextField fullWidth label="รุ่น" value={item.model ?? ''} onChange={(e) => updateItem(idx, { model: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
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
      <Dialog open={trackingTarget !== null} onClose={() => !trackingSaving && setTrackingTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Tracking — {trackingTarget?.platformOrderNo}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {trackingError && <Alert severity="error">{trackingError}</Alert>}
          <TextField
            label="เลข Tracking"
            value={trackingNo}
            onChange={(event) => setTrackingNo(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            autoFocus
          />
          <TextField
            label="บริษัทขนส่ง"
            value={trackingCourier}
            onChange={(event) => setTrackingCourier(event.target.value)}
          />
          <Typography variant="caption" color="text.secondary">ข้อมูลนี้ใช้ร่วมกับสินค้าทุกรายการใน Order</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingTarget(null)} disabled={trackingSaving}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleSetTracking} disabled={trackingSaving}>
            {trackingSaving ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

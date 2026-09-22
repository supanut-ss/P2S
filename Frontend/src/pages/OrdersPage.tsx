import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { purchaseOrderStatusLabel } from '../theme/tokens';
import { createOrder, listOrders, markPaid, type CreateOrderItemInput } from '../api/ordersApi';
import { getPlatforms, getProducts } from '../api/masterDataApi';
import type { PlatformResponse, ProductResponse, PurchaseOrderResponse } from '../types/models';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function OrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderResponse[]>([]);
  const [platforms, setPlatforms] = useState<PlatformResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formPlatformId, setFormPlatformId] = useState<number | ''>('');
  const [formOrderNo, setFormOrderNo] = useState('');
  const [formItems, setFormItems] = useState<CreateOrderItemInput[]>([{ productId: 0, qty: 1, unitPrice: 0 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, platformsData, productsData] = await Promise.all([
        listOrders({ status: statusFilter || undefined, search: search || undefined }),
        getPlatforms(),
        getProducts(),
      ]);
      setOrders(ordersData);
      setPlatforms(platformsData);
      setProducts(productsData);
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
    } catch {
      setFormError('สร้างออเดอร์ไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      await markPaid(id);
      await load();
    } catch {
      setError('mark-paid ไม่สำเร็จ');
    }
  };

  const total = formItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

  return (
    <>
      <PageHeader
        title="Order list"
        subtitle="filter platform/user/status, ค้นหาเลขออเดอร์"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>สั่งของใหม่</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField select label="สถานะ" size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">ทุกสถานะ</MenuItem>
          {Object.entries(purchaseOrderStatusLabel).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </TextField>
        <TextField
          label="ค้นหาเลขออเดอร์"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outlined" onClick={handleSearch}>ค้นหา</Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Platform</TableCell>
              <TableCell>เลขออเดอร์</TableCell>
              <TableCell>ผู้สั่ง</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
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
                <TableCell align="right">{thb.format(o.totalAmount)}</TableCell>
                <TableCell><StatusBadge status={o.status} label={purchaseOrderStatusLabel[o.status] ?? o.status} /></TableCell>
                <TableCell>{new Date(o.orderedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {o.status === 'Ordered' && (
                    <Button size="small" onClick={() => handleMarkPaid(o.id)}>จ่ายแล้ว</Button>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>สั่งของใหม่</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField select label="Platform" value={formPlatformId} onChange={(e) => setFormPlatformId(Number(e.target.value))}>
            {platforms.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField label="เลขออเดอร์ (จากแอพ)" value={formOrderNo} onChange={(e) => setFormOrderNo(e.target.value)} />

          <Typography variant="subtitle2">รายการสินค้า</Typography>
          {formItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField select label="สินค้า" size="small" value={item.productId || ''} onChange={(e) => updateItem(idx, { productId: Number(e.target.value) })} sx={{ flex: 2 }}>
                {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
              <TextField label="จำนวน" size="small" type="number" value={item.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} sx={{ flex: 1 }} />
              <TextField label="ราคา/ชิ้น" size="small" type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => removeItem(idx)} disabled={formItems.length === 1}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addItem} sx={{ alignSelf: 'flex-start' }}>เพิ่มรายการ</Button>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>ยอดรวม: {thb.format(total)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleCreate} disabled={submitting}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

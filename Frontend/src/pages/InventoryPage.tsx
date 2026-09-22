import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { inventoryItemStatusLabel } from '../theme/tokens';
import { listInventory, withdraw } from '../api/inventoryApi';
import { getWithdrawalReasons } from '../api/masterDataApi';
import type { InventoryItemResponse, WithdrawalReasonResponse } from '../types/models';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItemResponse[]>([]);
  const [reasons, setReasons] = useState<WithdrawalReasonResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<InventoryItemResponse | null>(null);
  const [qty, setQty] = useState(1);
  const [reasonId, setReasonId] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsData, reasonsData] = await Promise.all([
        listInventory({ status: statusFilter || undefined }),
        getWithdrawalReasons(),
      ]);
      setItems(itemsData);
      setReasons(reasonsData);
    } catch {
      setError('โหลดรายการคลังไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openWithdraw = (item: InventoryItemResponse) => {
    setTarget(item);
    setQty(1);
    setReasonId(reasons[0]?.id ?? '');
    setNote('');
    setFormError(null);
  };

  const handleWithdraw = async () => {
    if (!target || reasonId === '' || qty <= 0) {
      setFormError('กรอกข้อมูลให้ครบ');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await withdraw(target.id, qty, reasonId, note || undefined);
      setTarget(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'เบิกของไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Inventory list" subtitle="รายการของในคลัง (sku, qty_on_hand, cost/unit, received_at) พร้อมปุ่มเบิกออก" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2 }}>
        <TextField select label="สถานะ" size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">ทุกสถานะ</MenuItem>
          {Object.entries(inventoryItemStatusLabel).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </TextField>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>สินค้า</TableCell>
              <TableCell align="right">รับเข้า</TableCell>
              <TableCell align="right">คงเหลือ</TableCell>
              <TableCell align="right">ต้นทุน/ชิ้น</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>รับเข้าเมื่อ</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.skuCode}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell align="right">{item.qtyReceived}</TableCell>
                <TableCell align="right">{item.qtyOnHand}</TableCell>
                <TableCell align="right">{thb.format(item.costPerUnit)}</TableCell>
                <TableCell><StatusBadge status={item.status} label={inventoryItemStatusLabel[item.status] ?? item.status} /></TableCell>
                <TableCell>{new Date(item.receivedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">
                  {item.status === 'InStock' && (
                    <Button size="small" onClick={() => openWithdraw(item)}>เบิกออก</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center">ไม่มีของในคลัง</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={target !== null} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>เบิกของออก — {target?.productName}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="จำนวน"
            type="number"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            helperText={target ? `คงเหลือ ${target.qtyOnHand} ชิ้น` : undefined}
          />
          <TextField select label="เหตุผล" value={reasonId} onChange={(e) => setReasonId(Number(e.target.value))}>
            {reasons.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </TextField>
          <TextField label="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleWithdraw} disabled={submitting}>เบิกออก</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

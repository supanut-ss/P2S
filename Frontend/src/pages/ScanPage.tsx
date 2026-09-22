import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Stack, TextField, Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { getPending, confirmArrived, cancelOrderItem } from '../api/deliveriesApi';
import { setTracking as setTrackingApi } from '../api/ordersApi';
import type { PendingOrderItemResponse } from '../types/models';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function ScanPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PendingOrderItemResponse[]>([]);
  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPending(query);
      setItems(data);
      setTrackingInputs((prev) => {
        const next = { ...prev };
        for (const item of data) {
          if (next[item.orderItemId] === undefined) next[item.orderItemId] = item.trackingNo ?? '';
        }
        return next;
      });
    } catch {
      setError('โหลดรายการรอรับของไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveTracking = async (item: PendingOrderItemResponse) => {
    const value = trackingInputs[item.orderItemId]?.trim();
    if (!value) return;
    try {
      await setTrackingApi(item.orderItemId, value);
      setMessage(`บันทึกเลข tracking ของ ${item.productName} แล้ว`);
      load(search);
    } catch {
      setError('บันทึกเลข tracking ไม่สำเร็จ');
    }
  };

  const handleConfirm = async (item: PendingOrderItemResponse) => {
    const scannedValue = trackingInputs[item.orderItemId]?.trim();
    if (!scannedValue) {
      setError('กรอกหรือสแกนเลข tracking ก่อนยืนยันรับของ');
      return;
    }
    const matchMethod = scannedValue === item.trackingNo ? 'Barcode' : 'ManualTrackingEntry';
    try {
      await confirmArrived(item.orderItemId, scannedValue, matchMethod);
      setMessage(`รับของ ${item.productName} เข้าคลังแล้ว`);
      load(search);
    } catch {
      setError('ยืนยันรับของไม่สำเร็จ');
    }
  };

  const handleCancel = async (item: PendingOrderItemResponse) => {
    try {
      await cancelOrderItem(item.orderItemId, 'ร้านยกเลิก/ของไม่มา');
      setMessage(`ยกเลิก ${item.productName} แล้ว`);
      load(search);
    } catch {
      setError('ยกเลิกไม่สำเร็จ');
    }
  };

  return (
    <>
      <PageHeader title="สแกนรับของ" subtitle="สแกนบาร์โค้ด/เลข tracking ของร้าน แล้ว confirm รับของ — ถ้าสแกนไม่ติด ค้นด้วยเลขออเดอร์แทนได้" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="ค้นหาเลขออเดอร์ / tracking / ชื่อสินค้า"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
        />
        <Button variant="outlined" onClick={() => load(search)}>ค้นหา</Button>
      </Box>

      <Stack spacing={2}>
        {items.map((item) => (
          <Card key={item.orderItemId} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{item.productName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.platformCode} · {item.platformOrderNo} · {item.qty} ชิ้น · {thb.format(item.unitPrice)}/ชิ้น
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  label="เลข tracking (สแกน/กรอกเอง)"
                  size="small"
                  value={trackingInputs[item.orderItemId] ?? ''}
                  onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [item.orderItemId]: e.target.value }))}
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <Button size="small" variant="outlined" onClick={() => handleSaveTracking(item)}>บันทึกเลข tracking</Button>
                <Button size="small" variant="contained" onClick={() => handleConfirm(item)}>ยืนยันรับของ</Button>
                <Button size="small" color="error" onClick={() => handleCancel(item)}>ยกเลิก/ไม่มา</Button>
              </Box>
            </CardContent>
          </Card>
        ))}
        {!loading && items.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            ไม่มีรายการรอรับของ
          </Typography>
        )}
      </Stack>
    </>
  );
}

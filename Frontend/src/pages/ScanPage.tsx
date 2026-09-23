import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, LinearProgress, Stack, TextField, Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { PageHeader } from '../components/PageHeader';
import { BarcodeScannerDialog } from '../components/BarcodeScannerDialog';
import { getPending, confirmArrived, cancelOrderItem } from '../api/deliveriesApi';
import { setTracking as setTrackingApi } from '../api/ordersApi';
import type { DeliveryMatchMethod, PendingOrderItemResponse } from '../types/models';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

// A value the staff typed by hand isn't proof the barcode actually matches this item — only
// a live camera decode is. Tracked separately from the input's text so matchMethod reported
// to the API reflects how the value was actually obtained, not just whether it happens to
// equal the string already on file.
type TrackingSource = 'scanned' | 'manual';

export function ScanPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PendingOrderItemResponse[]>([]);
  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});
  const [trackingSources, setTrackingSources] = useState<Record<number, TrackingSource>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // null = closed, 'search' = scanning to fill the top search box, a number = scanning to
  // fill that order item's tracking field.
  const [scanTarget, setScanTarget] = useState<'search' | number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PendingOrderItemResponse | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
    const matchMethod: DeliveryMatchMethod = trackingSources[item.orderItemId] === 'scanned' ? 'Barcode' : 'ManualTrackingEntry';
    try {
      await confirmArrived(item.orderItemId, scannedValue, matchMethod);
      setMessage(`รับของ ${item.productName} เข้าคลังแล้ว`);
      load(search);
    } catch {
      setError('ยืนยันรับของไม่สำเร็จ');
    }
  };

  const handleCancel = async (item: PendingOrderItemResponse) => {
    setCancelling(true);
    try {
      await cancelOrderItem(item.orderItemId, 'ร้านยกเลิก/ของไม่มา');
      setMessage(`ยกเลิก ${item.productName} แล้ว`);
      setCancelTarget(null);
      load(search);
    } catch {
      setError('ยกเลิกไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  };

  const handleScanDetected = useCallback((code: string) => {
    if (scanTarget === 'search') {
      setSearch(code);
      load(code);
    } else if (typeof scanTarget === 'number') {
      setTrackingInputs((prev) => ({ ...prev, [scanTarget]: code }));
      setTrackingSources((prev) => ({ ...prev, [scanTarget]: 'scanned' }));
    }
    setScanTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTarget]);

  return (
    <>
      <PageHeader title="สแกนรับของ" subtitle="สแกนบาร์โค้ด/เลข tracking ของร้าน แล้ว confirm รับของ — ถ้าสแกนไม่ติด ค้นด้วยเลขออเดอร์แทนได้" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดรายการรับของ" sx={{ mb: 2 }} />}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'minmax(0, 1fr) auto auto' }, gap: 1, mb: 3 }}>
        <TextField
          label="ค้นหาเลขออเดอร์ / tracking / ชื่อสินค้า"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
          sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        />
        <Button variant="outlined" startIcon={<CameraAltIcon />} onClick={() => setScanTarget('search')} sx={{ whiteSpace: 'nowrap', minHeight: 44 }}>
          สแกนกล้อง
        </Button>
        <Button variant="outlined" onClick={() => load(search)} sx={{ minHeight: 44 }}>ค้นหา</Button>
      </Box>

      <Stack spacing={2}>
        {items.map((item) => (
          <Card key={item.orderItemId} variant="outlined">
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{item.productName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.platformCode} · {item.platformOrderNo} · {item.qty} ชิ้น · {thb.format(item.unitPrice)}/ชิ้น
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(200px, 1fr) auto auto auto auto' }, gap: 1, alignItems: 'center' }}>
                <TextField
                  label="เลข tracking (สแกน/กรอกเอง)"
                  size="small"
                  value={trackingInputs[item.orderItemId] ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTrackingInputs((prev) => ({ ...prev, [item.orderItemId]: value }));
                    setTrackingSources((prev) => ({ ...prev, [item.orderItemId]: 'manual' }));
                  }}
                  sx={{ minWidth: 0 }}
                />
                <IconButton color="primary" onClick={() => setScanTarget(item.orderItemId)} aria-label="สแกนบาร์โค้ด" sx={{ minWidth: 44, minHeight: 44 }}>
                  <CameraAltIcon fontSize="small" />
                </IconButton>
                <Button size="small" variant="outlined" onClick={() => handleSaveTracking(item)} sx={{ minHeight: 40, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>บันทึกเลข tracking</Button>
                <Button size="small" variant="contained" onClick={() => handleConfirm(item)} sx={{ minHeight: 40 }}>ยืนยันรับของ</Button>
                <Button size="small" color="error" onClick={() => setCancelTarget(item)} sx={{ minHeight: 44 }}>ยกเลิก/ไม่มา</Button>
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

      <BarcodeScannerDialog
        open={scanTarget !== null}
        title={scanTarget === 'search' ? 'สแกนเพื่อค้นหา' : 'สแกนเลข tracking'}
        onClose={() => setScanTarget(null)}
        onDetected={handleScanDetected}
      />
      <Dialog open={cancelTarget !== null} onClose={() => !cancelling && setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ยืนยันยกเลิกรายการ</DialogTitle>
        <DialogContent><DialogContentText>ยกเลิก {cancelTarget?.productName} และบันทึกว่าไม่ได้รับของ?</DialogContentText></DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling}>กลับ</Button>
          <Button color="error" variant="contained" disabled={cancelling} onClick={() => cancelTarget && handleCancel(cancelTarget)}>ยืนยันยกเลิก</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

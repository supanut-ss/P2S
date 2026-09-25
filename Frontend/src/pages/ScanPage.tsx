import { useCallback, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, LinearProgress,
  Stack, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { PageHeader } from '../components/PageHeader';
import { BarcodeScannerDialog } from '../components/BarcodeScannerDialog';
import { cancelOrderItem, lookupGoodsReceiptOrder, receiveGoodsOrder, reverseGoodsReceipt } from '../api/deliveriesApi';
import { useAuth } from '../auth/AuthContext';
import type { GoodsReceiptOrderLineResponse, GoodsReceiptOrderResponse } from '../types/models';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

type CancelTarget = { order: GoodsReceiptOrderResponse; item: GoodsReceiptOrderLineResponse };

function initialQuantities(orders: GoodsReceiptOrderResponse[]) {
  return Object.fromEntries(orders.flatMap((order) =>
    order.items.map((item) => [item.orderItemId, String(item.status === 'Pending' ? item.remainingQty : 0)]),
  ));
}

function emptyQuantities(orders: GoodsReceiptOrderResponse[]) {
  return Object.fromEntries(orders.flatMap((order) => order.items.map((item) => [item.orderItemId, '0'])));
}

function itemStatus(item: GoodsReceiptOrderLineResponse) {
  if (item.status === 'Cancelled') return 'ยกเลิกแล้ว';
  if (item.status === 'Returned') return 'คืนครบแล้ว';
  if (item.remainingQty === 0) return 'รับครบแล้ว';
  if (item.receivedQty > 0) return 'รับบางส่วน';
  return 'รอรับ';
}

export function ScanPage() {
  const { user } = useAuth();
  const [orderNo, setOrderNo] = useState('');
  const [orders, setOrders] = useState<GoodsReceiptOrderResponse[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [searching, setSearching] = useState(false);
  const [busyOrderIds, setBusyOrderIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelRefundAmount, setCancelRefundAmount] = useState('0');
  const [cancelling, setCancelling] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<{ order: GoodsReceiptOrderResponse; eventId: number } | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const orderNoInput = useRef<HTMLInputElement>(null);
  const busyOrderRef = useRef(new Set<number>());

  const handleOrderNoDetected = useCallback((code: string) => {
    setOrderNo(code.trim());
    setScannerOpen(false);
    // Auto-submit after scan
    setTimeout(() => {
      orderNoInput.current?.form?.requestSubmit();
    }, 100);
  }, []);

  const handleLookup = async () => {
    const exactOrderNo = orderNo.trim();
    if (!exactOrderNo || searching || busyOrderRef.current.size > 0) return;

    setSearching(true);
    setError(null);
    setMessage(null);
    setOrders([]);
    setQuantities({});
    try {
      const foundOrders = await lookupGoodsReceiptOrder(exactOrderNo);
      setOrders(foundOrders);
      setQuantities(initialQuantities(foundOrders));
      if (foundOrders.length === 0) setError('ไม่พบเลข Order นี้ในรายการของคุณ');
    } catch {
      setError('ค้นหา Order ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSearching(false);
    }
  };

  const setOrderQuantities = (order: GoodsReceiptOrderResponse, fillRemaining: boolean) => {
    setQuantities((previous) => {
      const next = { ...previous };
      for (const item of order.items) {
        next[item.orderItemId] = String(fillRemaining && item.status === 'Pending' ? item.remainingQty : 0);
      }
      return next;
    });
  };

  const quantityFor = (item: GoodsReceiptOrderLineResponse) => {
    const value = quantities[item.orderItemId] ?? String(item.remainingQty);
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > item.remainingQty || item.status !== 'Pending') return 0;
    return quantity;
  };

  const handleReceive = async (order: GoodsReceiptOrderResponse) => {
    if (busyOrderRef.current.has(order.purchaseOrderId)) return;
    const lines = order.items
      .map((item) => ({ orderItemId: item.orderItemId, quantity: quantityFor(item) }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) return;

    busyOrderRef.current.add(order.purchaseOrderId);
    setBusyOrderIds((previous) => new Set(previous).add(order.purchaseOrderId));
    setError(null);
    setMessage(null);
    try {
      const result = await receiveGoodsOrder(order.purchaseOrderId, lines);
      setMessage(`รับสินค้า ${result.lineCount} รายการ รวม ${result.unitCount} ชิ้น เข้าคลังแล้ว`);
      setOrders([]);
      setQuantities({});
      orderNoInput.current?.focus();
      try {
        const refreshedOrders = await lookupGoodsReceiptOrder(orderNo.trim());
        setOrders(refreshedOrders);
        setQuantities(emptyQuantities(refreshedOrders));
      } catch {
        setError('รับเข้าคลังแล้ว แต่โหลดสถานะ Order ใหม่ไม่สำเร็จ กดค้นหาอีกครั้งเพื่อตรวจยอด');
      }
    } catch (cause) {
      const responseMessage = (cause as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(responseMessage ?? 'บันทึกรับของไม่สำเร็จ กรุณาค้นหา Order ใหม่ก่อนลองอีกครั้ง');
      try {
        const refreshedOrders = await lookupGoodsReceiptOrder(orderNo.trim());
        setOrders(refreshedOrders);
        setQuantities(emptyQuantities(refreshedOrders));
      } catch {
        // Keep the original receive error visible if the refresh also fails.
      }
    } finally {
      busyOrderRef.current.delete(order.purchaseOrderId);
      setBusyOrderIds((previous) => {
        const next = new Set(previous);
        next.delete(order.purchaseOrderId);
        return next;
      });
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget || cancelling || busyOrderRef.current.has(cancelTarget.order.purchaseOrderId)) return;
    const purchaseOrderId = cancelTarget.order.purchaseOrderId;
    busyOrderRef.current.add(purchaseOrderId);
    setBusyOrderIds((previous) => new Set(previous).add(purchaseOrderId));
    setCancelling(true);
    setError(null);
    try {
      await cancelOrderItem(cancelTarget.item.orderItemId, 'ร้านยกเลิก/ของไม่มา', Number(cancelRefundAmount));
      setMessage(`ยกเลิกสินค้า ${cancelTarget.item.productName} แล้ว`);
      setCancelTarget(null);
      setOrders([]);
      setQuantities({});
      try {
        const refreshedOrders = await lookupGoodsReceiptOrder(orderNo.trim());
        setOrders(refreshedOrders);
        setQuantities(emptyQuantities(refreshedOrders));
      } catch {
        setError('ยกเลิกรายการแล้ว แต่โหลดสถานะ Order ใหม่ไม่สำเร็จ กดค้นหาอีกครั้งเพื่อตรวจยอด');
      }
    } catch (cause) {
      const responseMessage = (cause as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCancelTarget(null);
      setError(responseMessage ?? 'ยกเลิกรายการไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setCancelling(false);
      busyOrderRef.current.delete(purchaseOrderId);
      setBusyOrderIds((previous) => {
        const next = new Set(previous);
        next.delete(purchaseOrderId);
        return next;
      });
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget || !reverseReason.trim() || reversing || busyOrderRef.current.has(reverseTarget.order.purchaseOrderId)) return;
    const purchaseOrderId = reverseTarget.order.purchaseOrderId;
    busyOrderRef.current.add(purchaseOrderId);
    setBusyOrderIds((previous) => new Set(previous).add(purchaseOrderId));
    setReversing(true);
    setError(null);
    try {
      await reverseGoodsReceipt(reverseTarget.eventId, reverseReason.trim());
      setMessage('รายการรับของถูกย้อนกลับแล้ว พร้อมเก็บประวัติการแก้ไข');
      setReverseTarget(null);
      setReverseReason('');
      setOrders([]);
      setQuantities({});
      try {
        const refreshedOrders = await lookupGoodsReceiptOrder(orderNo.trim());
        setOrders(refreshedOrders);
        setQuantities(emptyQuantities(refreshedOrders));
      } catch {
        setError('ย้อนรายการแล้ว แต่โหลดสถานะ Order ใหม่ไม่สำเร็จ กดค้นหาอีกครั้งเพื่อตรวจยอด');
      }
    } catch (cause) {
      const responseMessage = (cause as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setReverseTarget(null);
      setReverseReason('');
      setError(responseMessage ?? 'ย้อนรายการไม่สำเร็จ กรุณาโหลด Order ใหม่');
    } finally {
      setReversing(false);
      busyOrderRef.current.delete(purchaseOrderId);
      setBusyOrderIds((previous) => {
        const next = new Set(previous);
        next.delete(purchaseOrderId);
        return next;
      });
    }
  };

  return (
    <>
      <PageHeader
        title="รับของด้วยเลข Order"
        subtitle="ค้นหาด้วยเลข Order แล้วเลือกสินค้าและจำนวนที่มาถึง ไม่ต้องใช้เลข Tracking"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {message && <Alert severity="success" role="status" aria-live="polite" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Card component="form" variant="outlined" onSubmit={(event) => { event.preventDefault(); void handleLookup(); }} sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(0, 1fr) auto auto' }, gap: 1.5, alignItems: 'start' }}>
            <TextField
              inputRef={orderNoInput}
              label="เลข Order"
              placeholder="กรอกหรือวางเลข Order"
              autoComplete="off"
              fullWidth
              value={orderNo}
              onChange={(event) => setOrderNo(event.target.value)}
              slotProps={{ htmlInput: { 'aria-label': 'เลข Order', inputMode: 'text' } }}
              helperText="ระบบค้นหาด้วยเลขที่ตรงกัน เพื่อป้องกันรับผิด Order"
            />
            <Button
              variant="outlined"
              startIcon={<CameraAltIcon />}
              onClick={() => setScannerOpen(true)}
              disabled={searching || busyOrderIds.size > 0}
              sx={{ minHeight: 56, px: 2, width: { xs: 'auto', sm: 'auto' } }}
              aria-label="สแกนบาร์โค้ดด้วยกล้อง"
            >
              สแกน
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!orderNo.trim() || searching || busyOrderIds.size > 0}
              sx={{ minHeight: 56, px: 3, width: { xs: '100%', sm: 'auto' }, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            >
              {searching ? 'กำลังค้นหา…' : 'ค้นหา Order'}
            </Button>
          </Box>
          {searching && <LinearProgress aria-label="กำลังค้นหา Order" sx={{ mt: 2 }} />}
        </CardContent>
      </Card>

      <BarcodeScannerDialog
        open={scannerOpen}
        title="สแกนเลข Order"
        onClose={() => setScannerOpen(false)}
        onDetected={handleOrderNoDetected}
      />

      <Stack spacing={2}>
        {orders.map((order) => {
          const selectedCount = order.items.reduce((sum, item) => sum + quantityFor(item), 0);
          const hasRemaining = order.items.some((item) => item.status === 'Pending' && item.remainingQty > 0);
          const isBusy = busyOrderIds.has(order.purchaseOrderId);

          return (
            <Card key={order.purchaseOrderId} variant="outlined">
              {isBusy && <LinearProgress aria-label={`กำลังรับ Order ${order.platformOrderNo}`} />}
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Chip label={order.platformCode} size="small" color="primary" variant="outlined" />
                      <Typography variant="h6" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>Order {order.platformOrderNo}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      สั่งเมื่อ {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(order.orderedAt))}
                    </Typography>
                    {(order.packageName || order.shopName) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>
                        {order.packageName && <>หน้ากล่อง {order.packageName}</>}
                        {order.packageName && order.shopName && " · "}
                        {order.shopName && <>ร้าน {order.shopName}</>}
                      </Typography>
                    )}
                    {(order.trackingNo || order.courier) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                        Tracking {order.trackingNo || 'ยังไม่ระบุ'}{order.courier ? ` · ${order.courier}` : ''}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Button size="small" variant="text" disabled={!hasRemaining || isBusy} onClick={() => setOrderQuantities(order, true)} sx={{ minHeight: 44 }}>
                      เติมจำนวนที่เหลือ
                    </Button>
                    <Button size="small" variant="text" disabled={!hasRemaining || isBusy} onClick={() => setOrderQuantities(order, false)} sx={{ minHeight: 44 }}>
                      ล้างจำนวน
                    </Button>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.25}>
                  {order.items.map((item) => {
                    const canReceive = item.status === 'Pending' && item.remainingQty > 0;
                    const canCancel = canReceive && item.receivedQty === 0;
                    const inputValue = quantities[item.orderItemId] ?? String(item.remainingQty);
                    const inputQuantity = Number(inputValue);
                    const invalidQuantity = inputValue !== '' && (!Number.isInteger(inputQuantity) || inputQuantity < 0 || inputQuantity > item.remainingQty);

                    return (
                      <Box
                        key={item.orderItemId}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'minmax(0, 1fr) 112px', sm: 'minmax(0, 1fr) 125px 110px' },
                          gap: { xs: 1, sm: 1.5 },
                          alignItems: 'center',
                          p: { xs: 1.25, sm: 1.5 },
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
                            <Chip label={itemStatus(item)} size="small" variant="outlined" color={item.remainingQty === 0 ? 'success' : item.receivedQty > 0 ? 'warning' : 'default'} />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            SKU {item.skuCode} · บรรทัด #{item.orderItemId} · สั่ง {item.qty} · รับแล้ว {item.receivedQty} · เหลือ {item.remainingQty} · {thb.format(item.unitPrice)}/ชิ้น
                          </Typography>
                          {(item.model || item.description || item.arrivedAt) && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                              {[item.model && `รุ่น ${item.model}`, item.arrivedAt && `รับครั้งแรก ${new Date(item.arrivedAt).toLocaleDateString('th-TH')}`, item.description].filter(Boolean).join(' · ')}
                            </Typography>
                          )}
                        </Box>
                        <TextField
                          size="small"
                          type="number"
                          label="มาถึงรอบนี้"
                          value={inputValue}
                          disabled={!canReceive || isBusy}
                          error={invalidQuantity}
                          helperText={invalidQuantity ? `ใส่จำนวนเต็ม 0–${item.remainingQty}` : ' '}
                          onChange={(event) => setQuantities((previous) => ({ ...previous, [item.orderItemId]: event.target.value }))}
                          slotProps={{ htmlInput: { min: 0, max: item.remainingQty, step: 1, inputMode: 'numeric', 'aria-label': `จำนวนที่มาถึงของ ${item.productName}` } }}
                        />
                        {canCancel ? (
                          <Button
                            color="error"
                            variant="text"
                            disabled={isBusy}
                            onClick={() => {
                              setCancelRefundAmount(String(item.qty * item.unitPrice));
                              setCancelTarget({ order, item });
                            }}
                            sx={{ minHeight: 44, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                          >
                            ยกเลิก / ไม่มา
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'left', sm: 'center' }, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                            {canReceive ? 'รับบางส่วนแล้ว' : itemStatus(item)}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Stack>

                {order.receiptHistory.length > 0 && (
                  <Accordion
                    disableGutters
                    elevation={0}
                    sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}>
                      <Typography sx={{ fontWeight: 600 }}>ประวัติการรับของ ({order.receiptHistory.length} รายการ)</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Stack spacing={1}>
                        {order.receiptHistory.map((event) => (
                          <Box key={event.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Chip label={event.eventType === 'Receipt' ? 'รับเข้า' : 'ย้อนรับ'} size="small" color={event.eventType === 'Receipt' ? 'success' : 'default'} />
                                <Typography variant="body2" color="text.secondary">
                                  {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurredAt))}
                                  {' · '}{event.actorUsername} · {event.lineCount} รายการ / {event.unitCount} ชิ้น
                                </Typography>
                              </Box>
                              {user?.role === 'admin' && event.eventType === 'Receipt' && !event.isReversed && (
                                <Button
                                  color="error"
                                  size="small"
                                  disabled={isBusy}
                                  onClick={() => { setReverseReason(''); setReverseTarget({ order, eventId: event.id }); }}
                                  sx={{ minHeight: 44 }}
                                >
                                  ย้อนรายการรับ
                                </Button>
                              )}
                            </Box>
                            <Stack spacing={0.25} sx={{ mt: 1 }}>
                              {event.lines.map((line, index) => (
                                <Typography key={`${event.id}-${index}`} variant="body2" color="text.secondary">
                                  {line.productName} ({line.skuCode}) × {event.eventType === 'Reversal' ? '−' : ''}{line.quantity} · {thb.format(line.unitPrice)}/ชิ้น
                                </Typography>
                              ))}
                            </Stack>
                            {event.reason && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>เหตุผล: {event.reason}</Typography>}
                          </Box>
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="contained"
                    disabled={selectedCount === 0 || isBusy}
                    onClick={() => void handleReceive(order)}
                    sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' }, px: 3 }}
                  >
                    รับเข้าคลัง {selectedCount > 0 ? `· ${selectedCount} ชิ้น` : ''}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Dialog open={cancelTarget !== null} onClose={() => !cancelling && setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ยืนยันยกเลิกรายการ</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <DialogContentText>ยกเลิก {cancelTarget?.item.productName} และบันทึกว่าไม่ได้รับของ? กรอกยอดเงินคืนที่ต้องติดตาม</DialogContentText>
          <TextField label="ยอดเงินคืนที่ต้องตาม" type="number" slotProps={{ htmlInput: { min: 0, step: '0.01' } }} value={cancelRefundAmount} onChange={(event) => setCancelRefundAmount(event.target.value)} />
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling} sx={{ minHeight: 44 }}>กลับ</Button>
          <Button color="error" variant="contained" disabled={cancelling} onClick={() => void handleCancel()} sx={{ minHeight: 44 }}>ยืนยันยกเลิก</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={reverseTarget !== null} onClose={() => !reversing && setReverseTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ย้อนรายการรับของ</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <DialogContentText>
            ย้อนการรับ Order {reverseTarget?.order.platformOrderNo}? ทำได้เมื่อสินค้ายังไม่ถูกเบิกหรือคืน และต้องระบุเหตุผล
          </DialogContentText>
          <TextField
            label="เหตุผลที่ย้อนรายการ"
            required
            multiline
            minRows={2}
            maxRows={4}
            value={reverseReason}
            onChange={(event) => setReverseReason(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setReverseTarget(null)} disabled={reversing} sx={{ minHeight: 44 }}>กลับ</Button>
          <Button color="error" variant="contained" disabled={reversing || !reverseReason.trim()} onClick={() => void handleReverse()} sx={{ minHeight: 44 }}>ยืนยันย้อนรายการ</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { inventoryItemStatusLabel } from '../theme/tokens';
import { listInventory, withdraw } from '../api/inventoryApi';
import { createSupplierReturn } from '../api/cancellationsApi';
import { getWithdrawalReasons } from '../api/masterDataApi';
import type { InventoryItemResponse, WithdrawalReasonResponse } from '../types/models';
import { useAuth } from '../auth/AuthContext';
import {
  AppDataGrid,
  AppDataGridToolbar,
  DataGridProductCell,
  DataGridStatusChip,
} from '../components/data-grid';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItemResponse[]>([]);
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<WithdrawalReasonResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<InventoryItemResponse | null>(null);
  const [qty, setQty] = useState(1);
  const [reasonId, setReasonId] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [returnTarget, setReturnTarget] = useState<InventoryItemResponse | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnRefundAmount, setReturnRefundAmount] = useState('0');
  const [returnNote, setReturnNote] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

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

  const openWithdraw = useCallback((item: InventoryItemResponse) => {
    setTarget(item);
    setQty(1);
    setReasonId(reasons[0]?.id ?? '');
    setNote('');
    setFormError(null);
  }, [reasons]);

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

  const openSupplierReturn = (item: InventoryItemResponse) => {
    setReturnTarget(item);
    setReturnQty(1);
    setReturnRefundAmount(String(item.costPerUnit));
    setReturnNote('');
    setReturnError(null);
  };

  const handleSupplierReturn = async () => {
    if (!returnTarget || returnQty <= 0 || Number(returnRefundAmount) < 0) {
      setReturnError('กรอกจำนวนและยอดคืนเงินให้ถูกต้อง');
      return;
    }
    setReturnSubmitting(true);
    setReturnError(null);
    try {
      await createSupplierReturn({
        inventoryItemId: returnTarget.id,
        quantity: returnQty,
        refundAmount: Number(returnRefundAmount),
        note: returnNote || undefined,
      });
      setReturnTarget(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setReturnError(msg ?? 'บันทึกคืนผู้ขายไม่สำเร็จ');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const canReturn = (item: InventoryItemResponse) =>
    item.qtyOnHand > 0 && (user?.role === 'admin' || user?.username === item.orderedByUsername);

  const skuGroups = useMemo(() => {
    const grouped = new Map<string, InventoryItemResponse[]>();
    items.forEach((item) => {
      const lots = grouped.get(item.skuCode) ?? [];
      lots.push(item);
      grouped.set(item.skuCode, lots);
    });

    return Array.from(grouped, ([skuCode, groupItems]) => {
      const lots = [...groupItems].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
      const qtyReceived = lots.reduce((sum, item) => sum + item.qtyReceived, 0);
      const qtyOnHand = lots.reduce((sum, item) => sum + item.qtyOnHand, 0);
      const stockValue = lots.reduce((sum, item) => sum + item.qtyOnHand * item.costPerUnit, 0);
      const receivedValue = lots.reduce((sum, item) => sum + item.qtyReceived * item.costPerUnit, 0);
      const averageCost = qtyOnHand > 0 ? stockValue / qtyOnHand : qtyReceived > 0 ? receivedValue / qtyReceived : 0;

      return {
        id: skuCode,
        skuCode,
        productId: lots[0].productId,
        productName: lots[0].productName,
        lots,
        qtyReceived,
        qtyOnHand,
        stockValue,
        averageCost,
        latestReceivedAt: lots[0].receivedAt,
        status: (qtyOnHand > 0 ? 'InStock' : 'Depleted') as InventoryItemResponse['status'],
      };
    }).sort((a, b) => a.skuCode.localeCompare(b.skuCode, 'th'));
  }, [items]);

  const visibleGroups = useMemo(() => {
    let list = skuGroups;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((g) => g.skuCode.toLowerCase().includes(q) || g.productName.toLowerCase().includes(q));
    }
    return list;
  }, [skuGroups, searchQuery]);

  const toggleSku = (skuCode: string) => {
    setExpandedSkus((current) => {
      const next = new Set(current);
      if (next.has(skuCode)) next.delete(skuCode);
      else next.add(skuCode);
      return next;
    });
  };

  // DataGrid Columns for Desktop
  const columns = useMemo<GridColDef<typeof skuGroups[number]>[]>(() => [
    {
      field: 'skuCode',
      headerName: 'SKU',
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'productName',
      headerName: 'สินค้า / รายการ',
      flex: 1.5,
      minWidth: 260,
      renderCell: (params) => (
        <DataGridProductCell
          name={params.row.productName}
          sku={params.row.skuCode}
          subtitle={`${params.row.lots.length} ล็อตสินค้า`}
        />
      ),
    },
    {
      field: 'qtyReceived',
      headerName: 'รับเข้ารวม',
      type: 'number',
      width: 110,
      headerAlign: 'right',
      align: 'right',
    },
    {
      field: 'qtyOnHand',
      headerName: 'คงเหลือรวม',
      type: 'number',
      width: 120,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'averageCost',
      headerName: 'ต้นทุนเฉลี่ย / มูลค่าคงเหลือ',
      width: 210,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => (
        <Box sx={{ textAlign: 'right', width: '100%' }}>
          <Typography variant="body2">{thb.format(params.row.averageCost)} / ชิ้น</Typography>
          <Typography variant="caption" color="text.secondary">
            มูลค่าคงเหลือ {thb.format(params.row.stockValue)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 130,
      renderCell: (params) => <DataGridStatusChip status={params.value} />,
    },
    {
      field: 'latestReceivedAt',
      headerName: 'รับเข้าล่าสุด',
      width: 130,
      valueFormatter: (value) => (value ? new Date(value).toLocaleDateString('th-TH') : '—'),
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 130,
      sortable: false,
      filterable: false,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => {
        const availableLot = params.row.lots.find((l) => l.qtyOnHand > 0 && l.status === 'InStock');
        if (!availableLot) return null;
        return (
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => {
              e.stopPropagation();
              openWithdraw(availableLot);
            }}
          >
            เบิกออก
          </Button>
        );
      },
    },
  ], [openWithdraw]);

  // Detail panel rendered when a row is expanded
  const renderDetailPanel = (group: typeof skuGroups[number]) => (
    <Box sx={{ pl: 4, pr: 2, py: 1 }}>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}>
        <Table size="small" aria-label={`ล็อตสินค้า SKU ${group.skuCode}`}>
          <TableHead>
            <TableRow>
              <TableCell>ออเดอร์ / ผู้สั่ง</TableCell>
              <TableCell>รับเข้าเมื่อ</TableCell>
              <TableCell align="right">รับเข้า</TableCell>
              <TableCell align="right">คงเหลือ</TableCell>
              <TableCell align="right">ต้นทุน/ชิ้น</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell align="right">จัดการล็อตนี้</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {group.lots.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.platformCode}: {item.platformOrderNo}</Typography>
                  <Typography variant="caption" color="text.secondary">ผู้สั่ง {item.orderedByUsername}</Typography>
                </TableCell>
                <TableCell>{new Date(item.receivedAt).toLocaleDateString('th-TH')}</TableCell>
                <TableCell align="right">{item.qtyReceived}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{item.qtyOnHand}</TableCell>
                <TableCell align="right">{thb.format(item.costPerUnit)}</TableCell>
                <TableCell><DataGridStatusChip status={item.status} /></TableCell>
                <TableCell align="right">
                  {item.status === 'InStock' && (
                    <Button size="small" variant="outlined" onClick={() => openWithdraw(item)} sx={{ mr: 1 }}>
                      เบิกออก
                    </Button>
                  )}
                  {canReturn(item) && (
                    <Button size="small" variant="outlined" color="warning" onClick={() => openSupplierReturn(item)}>
                      คืนผู้ขาย
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <>
      <PageHeader title="คลังสินค้า" subtitle="ยอดรวมแยกตาม SKU และขยายดูรายละเอียดแต่ละล็อตได้" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดคลังสินค้า" sx={{ mb: 2 }} />}

      {/* Desktop View: MUI X Data Grid with In-house Master-Detail */}
      <Box sx={{ display: { xs: 'none', lg: 'block' }, mb: 3 }}>
        <AppDataGrid
          rows={visibleGroups}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.skuCode}
          renderDetailPanel={renderDetailPanel}
          toolbar={
            <AppDataGridToolbar
              statusOptions={[
                { value: '', label: 'ทุกสถานะ' },
                { value: 'InStock', label: 'มีในคลัง' },
                { value: 'Depleted', label: 'หมดแล้ว' },
              ]}
              selectedStatus={statusFilter}
              onStatusChange={(val) => setStatusFilter(val)}
              searchValue={searchQuery}
              onSearchChange={(val) => setSearchQuery(val)}
              searchPlaceholder="ค้นหา SKU หรือชื่อสินค้า..."
            />
          }
          emptyMessage="ไม่มีของในคลัง"
          rowHeight={76}
        />
      </Box>

      {/* Mobile View: Card View */}
      <Box sx={{ display: { xs: 'block', lg: 'none' }, mb: 2 }}>
        <ResponsiveSelectField
          label="สถานะ"
          size="small"
          value={statusFilter}
          options={[{ value: '', label: 'ทุกสถานะ' }, ...Object.entries(inventoryItemStatusLabel).map(([value, label]) => ({ value, label }))]}
          onChange={(value) => setStatusFilter(String(value))}
          sx={{ minWidth: 180 }}
        />
      </Box>

      <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1.5 }}>
        {visibleGroups.map((group) => {
          const expanded = expandedSkus.has(group.skuCode);
          const detailsId = `sku-mobile-lots-${group.productId}`;
          return (
            <Paper key={group.skuCode} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{group.productName}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>SKU: {group.skuCode} · {group.lots.length} ล็อต</Typography>
                </Box>
                <IconButton
                  aria-label={expanded ? `ย่อรายการล็อต SKU ${group.skuCode}` : `ขยายรายการล็อต SKU ${group.skuCode}`}
                  aria-expanded={expanded}
                  aria-controls={expanded ? detailsId : undefined}
                  onClick={() => toggleSku(group.skuCode)}
                  sx={{ minWidth: 44, minHeight: 44, mt: -0.75, mr: -0.75 }}
                >
                  {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                </IconButton>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">รับเข้ารวม</Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{group.qtyReceived} ชิ้น</Typography>
                <Typography variant="body2" color="text.secondary">คงเหลือรวม</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{group.qtyOnHand} ชิ้น</Typography>
                <Typography variant="body2" color="text.secondary">ต้นทุนเฉลี่ย / มูลค่าคงเหลือ</Typography>
                <Typography variant="body2" sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {thb.format(group.averageCost)} / {thb.format(group.stockValue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">สถานะ / รับเข้าล่าสุด</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0.75 }}>
                  <StatusBadge status={group.status} label={inventoryItemStatusLabel[group.status] ?? group.status} />
                  <Typography variant="caption">{new Date(group.latestReceivedAt).toLocaleDateString('th-TH')}</Typography>
                </Box>
              </Box>
              <Collapse id={detailsId} in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  {group.lots.map((item) => (
                    <Box key={item.id} sx={{ pt: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {item.platformCode}: {item.platformOrderNo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ผู้สั่ง {item.orderedByUsername} · รับเข้า {new Date(item.receivedAt).toLocaleDateString('th-TH')}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0.5, mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">รับเข้า / คงเหลือ</Typography>
                        <Typography variant="body2">{item.qtyReceived} / {item.qtyOnHand} ชิ้น</Typography>
                        <Typography variant="body2" color="text.secondary">ต้นทุน/ชิ้น</Typography>
                        <Typography variant="body2">{thb.format(item.costPerUnit)}</Typography>
                        <Typography variant="body2" color="text.secondary">สถานะ</Typography>
                        <Box sx={{ justifySelf: 'end' }}><StatusBadge status={item.status} label={inventoryItemStatusLabel[item.status] ?? item.status} /></Box>
                      </Box>
                      {(item.status === 'InStock' || canReturn(item)) && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          {item.status === 'InStock' && <Button fullWidth variant="outlined" sx={{ minHeight: 44 }} onClick={() => openWithdraw(item)}>เบิกออก</Button>}
                          {canReturn(item) && <Button fullWidth variant="outlined" color="warning" sx={{ minHeight: 44 }} onClick={() => openSupplierReturn(item)}>คืนผู้ขาย</Button>}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
        {!loading && visibleGroups.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>ไม่มีของในคลัง</Paper>
        )}
      </Box>

      {/* Dialogs */}
      <Dialog open={target !== null} onClose={() => setTarget(null)} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 'calc(100% - 32px)' }, height: { xs: '100dvh', sm: 'auto' }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' }, borderRadius: { xs: 0, sm: 2 } } }}>
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
          <ResponsiveSelectField
            label="เหตุผล"
            value={reasonId}
            options={reasons.map((reason) => ({ value: reason.id, label: reason.name }))}
            onChange={(value) => setReasonId(Number(value))}
          />
          <TextField label="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 }, px: { xs: 2, sm: 1 }, display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, '& > button': { width: { xs: '100%', sm: 'auto' }, minHeight: 44 } }}>
          <Button onClick={() => setTarget(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleWithdraw} disabled={submitting}>เบิกออก</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={returnTarget !== null} onClose={() => !returnSubmitting && setReturnTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>คืนผู้ขาย — {returnTarget?.productName}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {returnError && <Alert severity="error">{returnError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            ออเดอร์ {returnTarget?.platformCode}: {returnTarget?.platformOrderNo} · คงเหลือ {returnTarget?.qtyOnHand} ชิ้น
          </Typography>
          <TextField label="จำนวนที่คืน" type="number" slotProps={{ htmlInput: { min: 1, max: returnTarget?.qtyOnHand, step: 1 } }} value={returnQty} onChange={(e) => setReturnQty(Number(e.target.value))} />
          <TextField label="ยอดเงินคืนที่ต้องตาม" type="number" slotProps={{ htmlInput: { min: 0, step: '0.01' } }} value={returnRefundAmount} onChange={(e) => setReturnRefundAmount(e.target.value)} />
          <TextField label="หมายเหตุ (ถ้ามี)" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
          <Button onClick={() => setReturnTarget(null)} disabled={returnSubmitting}>ยกเลิก</Button>
          <Button variant="contained" color="warning" onClick={handleSupplierReturn} disabled={returnSubmitting}>
            {returnSubmitting ? 'กำลังบันทึก…' : 'บันทึกคืนและตัด stock'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  LinearProgress, Paper, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { PageHeader } from '../components/PageHeader';
import { ResponsiveSelectField } from '../components/ResponsiveSelectField';
import {
  createPlatform, createProduct, createUser, createWithdrawalReason,
  deletePlatform, deleteProduct, deleteUser, deleteWithdrawalReason,
  getPlatforms, getProducts, getUsers, getWithdrawalReasons,
  updatePlatform, updateProduct, updateUser, updateWithdrawalReason,
} from '../api/masterDataApi';
import type { PlatformResponse, ProductResponse, UserResponse, WithdrawalReasonResponse } from '../types/models';

function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return active ? <Box sx={{ mt: 2 }}>{children}</Box> : null;
}

// ── Generic confirm-delete dialog ─────────────────────────────────────────────
function ConfirmDeleteDialog({
  open, title, description, onClose, onConfirm, loading,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{description}</Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}>ยกเลิก</Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={loading}>ลบ</Button>
      </DialogActions>
    </Dialog>
  );
}

export function AdminPage() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Products ──────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('ทั่วไป');
  const [newProductUnit, setNewProductUnit] = useState('ชิ้น');

  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editCategory, setEditCategory] = useState('ทั่วไป');
  const [editUnit, setEditUnit] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deletingProduct, setDeletingProduct] = useState<ProductResponse | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Platforms ─────────────────────────────────────────────────────────────
  const [platforms, setPlatforms] = useState<PlatformResponse[]>([]);
  const [newPlatformCode, setNewPlatformCode] = useState('');
  const [newPlatformName, setNewPlatformName] = useState('');

  const [editingPlatform, setEditingPlatform] = useState<PlatformResponse | null>(null);
  const [editPlatformName, setEditPlatformName] = useState('');
  const [editPlatformError, setEditPlatformError] = useState<string | null>(null);
  const [editPlatformSubmitting, setEditPlatformSubmitting] = useState(false);

  const [deletingPlatform, setDeletingPlatform] = useState<PlatformResponse | null>(null);

  // ── Withdrawal reasons ────────────────────────────────────────────────────
  const [reasons, setReasons] = useState<WithdrawalReasonResponse[]>([]);
  const [newReasonName, setNewReasonName] = useState('');

  const [editingReason, setEditingReason] = useState<WithdrawalReasonResponse | null>(null);
  const [editReasonName, setEditReasonName] = useState('');
  const [editReasonError, setEditReasonError] = useState<string | null>(null);
  const [editReasonSubmitting, setEditReasonSubmitting] = useState(false);

  const [deletingReason, setDeletingReason] = useState<WithdrawalReasonResponse | null>(null);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState('staff');

  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);

  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, pl, r, u] = await Promise.all([getProducts(), getPlatforms(), getWithdrawalReasons(), getUsers()]);
      setProducts(p);
      setPlatforms(pl);
      setReasons(r);
      setUsers(u);
    } catch {
      setError('โหลดข้อมูล master data ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Products handlers ─────────────────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!newProductName.trim() || !newProductSku.trim()) return;
    try {
      await createProduct({ name: newProductName.trim(), skuCode: newProductSku.trim(), category: newProductCategory.trim() || 'ทั่วไป', unit: newProductUnit });
      setNewProductName(''); setNewProductSku(''); setNewProductCategory('ทั่วไป');
      loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'เพิ่มสินค้าไม่สำเร็จ');
    }
  };

  const handleToggleProduct = async (p: ProductResponse) => {
    await updateProduct(p.id, { name: p.name, skuCode: p.skuCode, category: p.category, unit: p.unit, isActive: !p.isActive });
    loadAll();
  };

  const openEditProduct = (p: ProductResponse) => {
    setEditingProduct(p); setEditName(p.name); setEditSku(p.skuCode); setEditCategory(p.category); setEditUnit(p.unit); setEditError(null);
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    if (!editName.trim() || !editSku.trim() || !editCategory.trim() || !editUnit.trim()) { setEditError('กรอกข้อมูลให้ครบ'); return; }
    setEditSubmitting(true); setEditError(null);
    try {
      await updateProduct(editingProduct.id, { name: editName.trim(), skuCode: editSku.trim(), category: editCategory.trim(), unit: editUnit.trim(), isActive: editingProduct.isActive });
      setEditingProduct(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(msg ?? 'บันทึกไม่สำเร็จ');
    } finally { setEditSubmitting(false); }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setDeleteSubmitting(true);
    try {
      await deleteProduct(deletingProduct.id);
      setDeletingProduct(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'ลบสินค้าไม่สำเร็จ');
      setDeletingProduct(null);
    } finally { setDeleteSubmitting(false); }
  };

  // ── Platforms handlers ────────────────────────────────────────────────────
  const handleAddPlatform = async () => {
    if (!newPlatformCode.trim() || !newPlatformName.trim()) return;
    try {
      await createPlatform({ code: newPlatformCode.trim().toUpperCase(), name: newPlatformName.trim() });
      setNewPlatformCode(''); setNewPlatformName(''); loadAll();
    } catch {
      setError('เพิ่ม platform ไม่สำเร็จ (code อาจซ้ำ)');
    }
  };

  const handleTogglePlatform = async (p: PlatformResponse) => {
    await updatePlatform(p.id, { name: p.name, isActive: !p.isActive }); loadAll();
  };

  const openEditPlatform = (p: PlatformResponse) => {
    setEditingPlatform(p); setEditPlatformName(p.name); setEditPlatformError(null);
  };

  const handleSavePlatformEdit = async () => {
    if (!editingPlatform) return;
    if (!editPlatformName.trim()) { setEditPlatformError('กรอกชื่อ'); return; }
    setEditPlatformSubmitting(true); setEditPlatformError(null);
    try {
      await updatePlatform(editingPlatform.id, { name: editPlatformName.trim(), isActive: editingPlatform.isActive });
      setEditingPlatform(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditPlatformError(msg ?? 'บันทึกไม่สำเร็จ');
    } finally { setEditPlatformSubmitting(false); }
  };

  const handleDeletePlatform = async () => {
    if (!deletingPlatform) return;
    setDeleteSubmitting(true);
    try {
      await deletePlatform(deletingPlatform.id);
      setDeletingPlatform(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'ลบ platform ไม่สำเร็จ');
      setDeletingPlatform(null);
    } finally { setDeleteSubmitting(false); }
  };

  // ── Reasons handlers ──────────────────────────────────────────────────────
  const handleAddReason = async () => {
    if (!newReasonName.trim()) return;
    await createWithdrawalReason({ name: newReasonName.trim() });
    setNewReasonName(''); loadAll();
  };

  const handleToggleReason = async (r: WithdrawalReasonResponse) => {
    await updateWithdrawalReason(r.id, { name: r.name, isActive: !r.isActive }); loadAll();
  };

  const openEditReason = (r: WithdrawalReasonResponse) => {
    setEditingReason(r); setEditReasonName(r.name); setEditReasonError(null);
  };

  const handleSaveReasonEdit = async () => {
    if (!editingReason) return;
    if (!editReasonName.trim()) { setEditReasonError('กรอกชื่อ'); return; }
    setEditReasonSubmitting(true); setEditReasonError(null);
    try {
      await updateWithdrawalReason(editingReason.id, { name: editReasonName.trim(), isActive: editingReason.isActive });
      setEditingReason(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditReasonError(msg ?? 'บันทึกไม่สำเร็จ');
    } finally { setEditReasonSubmitting(false); }
  };

  const handleDeleteReason = async () => {
    if (!deletingReason) return;
    setDeleteSubmitting(true);
    try {
      await deleteWithdrawalReason(deletingReason.id);
      setDeletingReason(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'ลบเหตุผลไม่สำเร็จ');
      setDeletingReason(null);
    } finally { setDeleteSubmitting(false); }
  };

  // ── Users handlers ────────────────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!newUsername.trim() || !newUserPassword.trim() || !newUserFullName.trim()) return;
    try {
      await createUser({ username: newUsername.trim(), password: newUserPassword, fullName: newUserFullName.trim(), role: newUserRole });
      setNewUsername(''); setNewUserPassword(''); setNewUserFullName(''); loadAll();
    } catch {
      setError('เพิ่มผู้ใช้ไม่สำเร็จ (username อาจซ้ำ)');
    }
  };

  const handleToggleUser = async (u: UserResponse) => {
    await updateUser(u.id, { fullName: u.fullName, isActive: !u.isActive, cardLast4: u.cardLast4 ?? undefined }); loadAll();
  };

  const openEditUser = (u: UserResponse) => {
    setEditingUser(u); setEditUserFullName(u.fullName); setEditUserRole(u.role); setEditUserError(null);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    if (!editUserFullName.trim()) { setEditUserError('กรอกชื่อเต็ม'); return; }
    setEditUserSubmitting(true); setEditUserError(null);
    try {
      await updateUser(editingUser.id, { fullName: editUserFullName.trim(), isActive: editingUser.isActive, cardLast4: editingUser.cardLast4 ?? undefined });
      setEditingUser(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditUserError(msg ?? 'บันทึกไม่สำเร็จ');
    } finally { setEditUserSubmitting(false); }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteSubmitting(true);
    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null); loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'ลบผู้ใช้ไม่สำเร็จ');
      setDeletingUser(null);
    } finally { setDeleteSubmitting(false); }
  };

  // ── Action cell helper ────────────────────────────────────────────────────
  const ActionButtons = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
      <IconButton size="small" onClick={onEdit} aria-label="แก้ไข"><EditIcon fontSize="small" /></IconButton>
      <IconButton size="small" onClick={onDelete} aria-label="ลบ" color="error"><DeleteIcon fontSize="small" /></IconButton>
    </Box>
  );

  return (
    <>
      <PageHeader title="Master data" subtitle="จัดการ users, platforms, withdrawal reasons, products" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading && <LinearProgress aria-label="กำลังโหลดข้อมูลหลัก" sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, px: { xs: 1.5, sm: 2 } } }}>
        <Tab label="สินค้า" />
        <Tab label="Platform" />
        <Tab label="เหตุผลเบิกของ" />
        <Tab label="ผู้ใช้งาน" />
      </Tabs>

      {/* ── Products tab ──────────────────────────────────────────────────── */}
      <TabPanel active={tab === 0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'minmax(140px, 1fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) 100px auto' }, gap: 1, mb: 2 }}>
          <TextField label="ชื่อสินค้า" size="small" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }} />
          <TextField label="SKU" size="small" value={newProductSku} onChange={(e) => setNewProductSku(e.target.value)} />
          <TextField label="หมวดหมู่" size="small" value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <TextField label="หน่วย" size="small" value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)} />
          <Button variant="contained" onClick={handleAddProduct} sx={{ minHeight: 40 }}>เพิ่ม</Button>
        </Box>

        {/* Desktop table */}
        <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>ชื่อ</TableCell><TableCell>SKU</TableCell><TableCell>หมวดหมู่</TableCell><TableCell>หน่วย</TableCell>
              <TableCell align="right">แก้ไข / ลบ</TableCell><TableCell align="right">เปิดใช้งาน</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.skuCode}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell align="right">
                    <ActionButtons onEdit={() => openEditProduct(p)} onDelete={() => setDeletingProduct(p)} />
                  </TableCell>
                  <TableCell align="right"><Switch checked={p.isActive} onChange={() => handleToggleProduct(p)} size="small" slotProps={{ input: { 'aria-label': `เปิดใช้งานสินค้า ${p.name}` } }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Mobile cards */}
        <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1 }}>
          {products.map((p) => (
            <Card key={p.id} variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{p.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{p.skuCode} · {p.unit}</Typography>
                    <Chip size="small" label={p.category} sx={{ mt: 0.5 }} />
                  </Box>
                  <IconButton onClick={() => openEditProduct(p)} aria-label={`แก้ไขสินค้า ${p.name}`} sx={{ minWidth: 44, minHeight: 44 }}><EditIcon /></IconButton>
                  <IconButton onClick={() => setDeletingProduct(p)} aria-label={`ลบสินค้า ${p.name}`} color="error" sx={{ minWidth: 44, minHeight: 44 }}><DeleteIcon /></IconButton>
                  <Switch checked={p.isActive} onChange={() => handleToggleProduct(p)} slotProps={{ input: { 'aria-label': `เปิดใช้งานสินค้า ${p.name}` } }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Edit dialog */}
        <Dialog open={editingProduct !== null} onClose={() => setEditingProduct(null)} maxWidth="xs" fullWidth fullScreen={isPhone}>
          <DialogTitle>แก้ไขสินค้า</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField label="ชื่อสินค้า" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            <TextField label="SKU" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
            <TextField label="หมวดหมู่" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
            <TextField label="หน่วย" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, '& > button': { width: { xs: '100%', sm: 'auto' }, minHeight: 44 } }}>
            <Button onClick={() => setEditingProduct(null)}>ยกเลิก</Button>
            <Button variant="contained" onClick={handleSaveProductEdit} disabled={editSubmitting}>บันทึก</Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirm */}
        <ConfirmDeleteDialog
          open={deletingProduct !== null}
          title="ลบสินค้า"
          description={`ต้องการลบ "${deletingProduct?.name}" ใช่หรือไม่?`}
          onClose={() => setDeletingProduct(null)}
          onConfirm={handleDeleteProduct}
          loading={deleteSubmitting}
        />
      </TabPanel>

      {/* ── Platforms tab ─────────────────────────────────────────────────── */}
      <TabPanel active={tab === 1}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 0.55fr) minmax(0, 1fr)', sm: '120px minmax(180px, 1fr) auto' }, gap: 1, mb: 2 }}>
          <TextField label="Code (เช่น SP)" size="small" value={newPlatformCode} onChange={(e) => setNewPlatformCode(e.target.value)} />
          <TextField label="ชื่อ" size="small" value={newPlatformName} onChange={(e) => setNewPlatformName(e.target.value)} />
          <Button variant="contained" onClick={handleAddPlatform} sx={{ minHeight: 40, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>เพิ่ม</Button>
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Code</TableCell><TableCell>ชื่อ</TableCell>
              <TableCell align="right">แก้ไข / ลบ</TableCell><TableCell align="right">เปิดใช้งาน</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {platforms.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Chip label={p.code} size="small" /></TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell align="right">
                    <ActionButtons onEdit={() => openEditPlatform(p)} onDelete={() => setDeletingPlatform(p)} />
                  </TableCell>
                  <TableCell align="right"><Switch checked={p.isActive} onChange={() => handleTogglePlatform(p)} size="small" slotProps={{ input: { 'aria-label': `เปิดใช้งาน ${p.name}` } }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1 }}>
          {platforms.map((p) => (
            <Card key={p.id} variant="outlined">
              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={p.code} size="small" />
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>{p.name}</Typography>
                  <IconButton onClick={() => openEditPlatform(p)} aria-label={`แก้ไข ${p.name}`} sx={{ minWidth: 44, minHeight: 44 }}><EditIcon /></IconButton>
                  <IconButton onClick={() => setDeletingPlatform(p)} aria-label={`ลบ ${p.name}`} color="error" sx={{ minWidth: 44, minHeight: 44 }}><DeleteIcon /></IconButton>
                  <Switch checked={p.isActive} onChange={() => handleTogglePlatform(p)} slotProps={{ input: { 'aria-label': `เปิดใช้งาน ${p.name}` } }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Edit dialog */}
        <Dialog open={editingPlatform !== null} onClose={() => setEditingPlatform(null)} maxWidth="xs" fullWidth fullScreen={isPhone}>
          <DialogTitle>แก้ไข Platform</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {editPlatformError && <Alert severity="error">{editPlatformError}</Alert>}
            <TextField label={`Code (${editingPlatform?.code})`} value={editingPlatform?.code ?? ''} disabled helperText="Code ไม่สามารถเปลี่ยนได้" />
            <TextField label="ชื่อ" value={editPlatformName} onChange={(e) => setEditPlatformName(e.target.value)} autoFocus />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => setEditingPlatform(null)}>ยกเลิก</Button>
            <Button variant="contained" onClick={handleSavePlatformEdit} disabled={editPlatformSubmitting}>บันทึก</Button>
          </DialogActions>
        </Dialog>

        <ConfirmDeleteDialog
          open={deletingPlatform !== null}
          title="ลบ Platform"
          description={`ต้องการลบ "${deletingPlatform?.name}" ใช่หรือไม่?`}
          onClose={() => setDeletingPlatform(null)}
          onConfirm={handleDeletePlatform}
          loading={deleteSubmitting}
        />
      </TabPanel>

      {/* ── Withdrawal reasons tab ────────────────────────────────────────── */}
      <TabPanel active={tab === 2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(240px, 1fr) auto' }, gap: 1, mb: 2 }}>
          <TextField label="เหตุผล" size="small" value={newReasonName} onChange={(e) => setNewReasonName(e.target.value)} />
          <Button variant="contained" onClick={handleAddReason} sx={{ minHeight: 40 }}>เพิ่ม</Button>
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>เหตุผล</TableCell>
              <TableCell align="right">แก้ไข / ลบ</TableCell><TableCell align="right">เปิดใช้งาน</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {reasons.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell align="right">
                    <ActionButtons onEdit={() => openEditReason(r)} onDelete={() => setDeletingReason(r)} />
                  </TableCell>
                  <TableCell align="right"><Switch checked={r.isActive} onChange={() => handleToggleReason(r)} size="small" slotProps={{ input: { 'aria-label': `เปิดใช้งานเหตุผล ${r.name}` } }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1 }}>
          {reasons.map((r) => (
            <Card key={r.id} variant="outlined">
              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>{r.name}</Typography>
                  <IconButton onClick={() => openEditReason(r)} aria-label={`แก้ไขเหตุผล ${r.name}`} sx={{ minWidth: 44, minHeight: 44 }}><EditIcon /></IconButton>
                  <IconButton onClick={() => setDeletingReason(r)} aria-label={`ลบเหตุผล ${r.name}`} color="error" sx={{ minWidth: 44, minHeight: 44 }}><DeleteIcon /></IconButton>
                  <Switch checked={r.isActive} onChange={() => handleToggleReason(r)} slotProps={{ input: { 'aria-label': `เปิดใช้งานเหตุผล ${r.name}` } }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Edit dialog */}
        <Dialog open={editingReason !== null} onClose={() => setEditingReason(null)} maxWidth="xs" fullWidth fullScreen={isPhone}>
          <DialogTitle>แก้ไขเหตุผลเบิกของ</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {editReasonError && <Alert severity="error">{editReasonError}</Alert>}
            <TextField label="เหตุผล" value={editReasonName} onChange={(e) => setEditReasonName(e.target.value)} autoFocus />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => setEditingReason(null)}>ยกเลิก</Button>
            <Button variant="contained" onClick={handleSaveReasonEdit} disabled={editReasonSubmitting}>บันทึก</Button>
          </DialogActions>
        </Dialog>

        <ConfirmDeleteDialog
          open={deletingReason !== null}
          title="ลบเหตุผลเบิกของ"
          description={`ต้องการลบ "${deletingReason?.name}" ใช่หรือไม่?`}
          onClose={() => setDeletingReason(null)}
          onConfirm={handleDeleteReason}
          loading={deleteSubmitting}
        />
      </TabPanel>

      {/* ── Users tab ─────────────────────────────────────────────────────── */}
      <TabPanel active={tab === 3}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'minmax(130px, 0.8fr) minmax(150px, 1fr) minmax(180px, 1fr) 120px auto' }, gap: 1, mb: 2 }}>
          <TextField label="Username" size="small" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          <TextField label="Password ชั่วคราว" size="small" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
          <TextField label="ชื่อเต็ม" size="small" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }} />
          <ResponsiveSelectField
            label="Role"
            size="small"
            value={newUserRole}
            options={[{ value: 'staff', label: 'staff' }, { value: 'finance', label: 'finance' }, { value: 'admin', label: 'admin' }]}
            onChange={(value) => setNewUserRole(String(value))}
          />
          <Button variant="contained" onClick={handleAddUser} sx={{ minHeight: 40 }}>เพิ่ม</Button>
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Username</TableCell><TableCell>ชื่อเต็ม</TableCell><TableCell>Role</TableCell>
              <TableCell align="right">แก้ไข / ลบ</TableCell><TableCell align="right">เปิดใช้งาน</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell><Chip label={u.role} size="small" /></TableCell>
                  <TableCell align="right">
                    <ActionButtons onEdit={() => openEditUser(u)} onDelete={() => setDeletingUser(u)} />
                  </TableCell>
                  <TableCell align="right"><Switch checked={u.isActive} onChange={() => handleToggleUser(u)} size="small" slotProps={{ input: { 'aria-label': `เปิดใช้งานผู้ใช้ ${u.username}` } }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1 }}>
          {users.map((u) => (
            <Card key={u.id} variant="outlined">
              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{u.fullName}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{u.username}</Typography>
                  </Box>
                  <Chip label={u.role} size="small" />
                  <IconButton onClick={() => openEditUser(u)} aria-label={`แก้ไขผู้ใช้ ${u.username}`} sx={{ minWidth: 44, minHeight: 44 }}><EditIcon /></IconButton>
                  <IconButton onClick={() => setDeletingUser(u)} aria-label={`ลบผู้ใช้ ${u.username}`} color="error" sx={{ minWidth: 44, minHeight: 44 }}><DeleteIcon /></IconButton>
                  <Switch checked={u.isActive} onChange={() => handleToggleUser(u)} slotProps={{ input: { 'aria-label': `เปิดใช้งานผู้ใช้ ${u.username}` } }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Edit dialog */}
        <Dialog open={editingUser !== null} onClose={() => setEditingUser(null)} maxWidth="xs" fullWidth fullScreen={isPhone}>
          <DialogTitle>แก้ไขผู้ใช้งาน</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {editUserError && <Alert severity="error">{editUserError}</Alert>}
            <TextField label="Username" value={editingUser?.username ?? ''} disabled helperText="Username ไม่สามารถเปลี่ยนได้" />
            <TextField label="ชื่อเต็ม" value={editUserFullName} onChange={(e) => setEditUserFullName(e.target.value)} autoFocus />
            <ResponsiveSelectField
              label="Role"
              value={editUserRole}
              options={[{ value: 'staff', label: 'staff' }, { value: 'finance', label: 'finance' }, { value: 'admin', label: 'admin' }]}
              onChange={(value) => setEditUserRole(String(value))}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => setEditingUser(null)}>ยกเลิก</Button>
            <Button variant="contained" onClick={handleSaveUserEdit} disabled={editUserSubmitting}>บันทึก</Button>
          </DialogActions>
        </Dialog>

        <ConfirmDeleteDialog
          open={deletingUser !== null}
          title="ลบผู้ใช้งาน"
          description={`ต้องการลบผู้ใช้ "${deletingUser?.username}" ใช่หรือไม่?`}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDeleteUser}
          loading={deleteSubmitting}
        />
      </TabPanel>
    </>
  );
}

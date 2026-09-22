import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, MenuItem, Paper, Switch, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import {
  createPlatform, createProduct, createUser, createWithdrawalReason,
  getPlatforms, getProducts, getUsers, getWithdrawalReasons,
  updatePlatform, updateProduct, updateUser, updateWithdrawalReason,
} from '../api/masterDataApi';
import type { PlatformResponse, ProductResponse, UserResponse, WithdrawalReasonResponse } from '../types/models';

function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return active ? <Box sx={{ mt: 2 }}>{children}</Box> : null;
}

export function AdminPage() {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('ชิ้น');

  const [platforms, setPlatforms] = useState<PlatformResponse[]>([]);
  const [newPlatformCode, setNewPlatformCode] = useState('');
  const [newPlatformName, setNewPlatformName] = useState('');

  const [reasons, setReasons] = useState<WithdrawalReasonResponse[]>([]);
  const [newReasonName, setNewReasonName] = useState('');

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState('staff');

  const loadAll = async () => {
    setError(null);
    try {
      const [p, pl, r, u] = await Promise.all([getProducts(), getPlatforms(), getWithdrawalReasons(), getUsers()]);
      setProducts(p);
      setPlatforms(pl);
      setReasons(r);
      setUsers(u);
    } catch {
      setError('โหลดข้อมูล master data ไม่สำเร็จ');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddProduct = async () => {
    if (!newProductName.trim() || !newProductSku.trim()) return;
    try {
      await createProduct({ name: newProductName.trim(), skuCode: newProductSku.trim(), unit: newProductUnit });
      setNewProductName(''); setNewProductSku('');
      loadAll();
    } catch {
      setError('เพิ่มสินค้าไม่สำเร็จ (SKU อาจซ้ำ)');
    }
  };

  const handleToggleProduct = async (p: ProductResponse) => {
    await updateProduct(p.id, { name: p.name, unit: p.unit, isActive: !p.isActive });
    loadAll();
  };

  const handleAddPlatform = async () => {
    if (!newPlatformCode.trim() || !newPlatformName.trim()) return;
    try {
      await createPlatform({ code: newPlatformCode.trim().toUpperCase(), name: newPlatformName.trim() });
      setNewPlatformCode(''); setNewPlatformName('');
      loadAll();
    } catch {
      setError('เพิ่ม platform ไม่สำเร็จ (code อาจซ้ำ)');
    }
  };

  const handleTogglePlatform = async (p: PlatformResponse) => {
    await updatePlatform(p.id, { name: p.name, isActive: !p.isActive });
    loadAll();
  };

  const handleAddReason = async () => {
    if (!newReasonName.trim()) return;
    await createWithdrawalReason({ name: newReasonName.trim() });
    setNewReasonName('');
    loadAll();
  };

  const handleToggleReason = async (r: WithdrawalReasonResponse) => {
    await updateWithdrawalReason(r.id, { name: r.name, isActive: !r.isActive });
    loadAll();
  };

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newUserPassword.trim() || !newUserFullName.trim()) return;
    try {
      await createUser({ username: newUsername.trim(), password: newUserPassword, fullName: newUserFullName.trim(), role: newUserRole });
      setNewUsername(''); setNewUserPassword(''); setNewUserFullName('');
      loadAll();
    } catch {
      setError('เพิ่มผู้ใช้ไม่สำเร็จ (username อาจซ้ำ)');
    }
  };

  const handleToggleUser = async (u: UserResponse) => {
    await updateUser(u.id, { fullName: u.fullName, isActive: !u.isActive, cardLast4: u.cardLast4 ?? undefined });
    loadAll();
  };

  return (
    <>
      <PageHeader title="Master data" subtitle="จัดการ users, platforms, withdrawal reasons, products" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="สินค้า" />
        <Tab label="Platform" />
        <Tab label="เหตุผลเบิกของ" />
        <Tab label="ผู้ใช้งาน" />
      </Tabs>

      <TabPanel active={tab === 0}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField label="ชื่อสินค้า" size="small" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
          <TextField label="SKU" size="small" value={newProductSku} onChange={(e) => setNewProductSku(e.target.value)} />
          <TextField label="หน่วย" size="small" value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)} sx={{ width: 100 }} />
          <Button variant="contained" onClick={handleAddProduct}>เพิ่ม</Button>
        </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell>ชื่อ</TableCell><TableCell>SKU</TableCell><TableCell>หน่วย</TableCell><TableCell align="right">เปิดใช้งาน</TableCell></TableRow></TableHead>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.skuCode}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell align="right"><Switch checked={p.isActive} onChange={() => handleToggleProduct(p)} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel active={tab === 1}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField label="Code (เช่น SP)" size="small" value={newPlatformCode} onChange={(e) => setNewPlatformCode(e.target.value)} sx={{ width: 120 }} />
          <TextField label="ชื่อ" size="small" value={newPlatformName} onChange={(e) => setNewPlatformName(e.target.value)} />
          <Button variant="contained" onClick={handleAddPlatform}>เพิ่ม</Button>
        </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>ชื่อ</TableCell><TableCell align="right">เปิดใช้งาน</TableCell></TableRow></TableHead>
            <TableBody>
              {platforms.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Chip label={p.code} size="small" /></TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell align="right"><Switch checked={p.isActive} onChange={() => handleTogglePlatform(p)} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel active={tab === 2}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField label="เหตุผล" size="small" value={newReasonName} onChange={(e) => setNewReasonName(e.target.value)} />
          <Button variant="contained" onClick={handleAddReason}>เพิ่ม</Button>
        </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell>เหตุผล</TableCell><TableCell align="right">เปิดใช้งาน</TableCell></TableRow></TableHead>
            <TableBody>
              {reasons.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell align="right"><Switch checked={r.isActive} onChange={() => handleToggleReason(r)} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel active={tab === 3}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField label="Username" size="small" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          <TextField label="Password ชั่วคราว" size="small" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
          <TextField label="ชื่อเต็ม" size="small" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} />
          <TextField select label="Role" size="small" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} sx={{ width: 120 }}>
            <MenuItem value="staff">staff</MenuItem>
            <MenuItem value="finance">finance</MenuItem>
            <MenuItem value="admin">admin</MenuItem>
          </TextField>
          <Button variant="contained" onClick={handleAddUser}>เพิ่ม</Button>
        </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell>Username</TableCell><TableCell>ชื่อเต็ม</TableCell><TableCell>Role</TableCell><TableCell align="right">เปิดใช้งาน</TableCell></TableRow></TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell><Chip label={u.role} size="small" /></TableCell>
                  <TableCell align="right"><Switch checked={u.isActive} onChange={() => handleToggleUser(u)} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
    </>
  );
}

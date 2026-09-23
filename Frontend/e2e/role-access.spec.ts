import { test, expect } from '@playwright/test';
import { login, selectMuiOption } from './helpers';

/**
 * Covers the role-based nav/route restriction added on top of the main flow: staff sees
 * only staff-relevant screens, finance sees only finance-relevant screens, admin sees
 * everything — and, critically, that hiding the nav link is backed by an actual route guard
 * (typing the URL directly must redirect, not just leave the link missing).
 */
test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString().slice(-8);
const staffUsername = `e2e-staff-${runId}`;
const financeUsername = `e2e-finance-${runId}`;
const password = 'E2ePass123!';

test('admin creates a staff and a finance user', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'ผู้ใช้งาน' }).click();

  await page.getByLabel('Username').fill(staffUsername);
  await page.getByLabel('Password ชั่วคราว').fill(password);
  await page.getByLabel('ชื่อเต็ม').fill('E2E Staff');
  await page.getByRole('button', { name: 'เพิ่ม' }).click();
  await expect(page.getByRole('cell', { name: staffUsername, exact: true })).toBeVisible();

  await page.getByLabel('Username').fill(financeUsername);
  await page.getByLabel('Password ชั่วคราว').fill(password);
  await page.getByLabel('ชื่อเต็ม').fill('E2E Finance');
  await selectMuiOption(page, 'Role', 'finance');
  await page.getByRole('button', { name: 'เพิ่ม' }).click();
  await expect(page.getByRole('cell', { name: financeUsername, exact: true })).toBeVisible();
});

test('staff sees only staff-relevant nav items and cannot reach admin-only routes by URL', async ({ page }) => {
  await login(page, staffUsername, password);

  await expect(page.getByRole('link', { name: 'ออเดอร์', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'รับของ', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'คลังสินค้า', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ยกเลิก', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'ข้อมูลหลัก', exact: true })).toHaveCount(0);

  // Nav hiding is cosmetic — the route guard is what actually matters.
  await page.goto('/admin');
  await expect(page).toHaveURL('/');
  await page.goto('/cancellations');
  await expect(page).toHaveURL('/');
});

test('finance sees only finance-relevant nav items and cannot reach staff-only routes by URL', async ({ page }) => {
  await login(page, financeUsername, password);

  await expect(page.getByRole('link', { name: 'เบิกเงิน', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ยกเลิก', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ออเดอร์', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'รับของ', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'คลังสินค้า', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'ข้อมูลหลัก', exact: true })).toHaveCount(0);

  await page.goto('/orders');
  await expect(page).toHaveURL('/');
  await page.goto('/admin');
  await expect(page).toHaveURL('/');
});

test('admin sees every nav item', async ({ page }) => {
  await login(page);
  for (const label of ['ออเดอร์', 'เบิกเงิน', 'รับของ', 'คลังสินค้า', 'ยกเลิก', 'ข้อมูลหลัก']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
});

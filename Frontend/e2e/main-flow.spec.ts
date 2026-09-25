import { test, expect } from '@playwright/test';
import { login, selectMuiOption } from './helpers';

/**
 * Covers the procure-to-stock happy path end to end, matching what was manually verified
 * against real MySQL throughout development (see git log for "business controllers" and
 * "wire screens" commits): create product → order → mark-paid → scan-confirm arrival
 * (auto-creates the inventory lot) → withdraw stock → request/approve/pay reimbursement →
 * order flips to Reimbursed.
 *
 * Steps run in one serial test rather than independent ones because each step's UI state
 * depends on the previous step's write (there's no API-level seeding helper here — this
 * suite exercises the actual screens, not just the API). Unique suffixes (Date.now()) let
 * this run repeatedly against the same database without colliding on SKU/order-number
 * uniqueness constraints.
 */
test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString().slice(-8);
const productName = `E2E เคสทดสอบ ${runId}`;
const skuCode = `SKU-E2E-${runId}`;
const orderNo = `E2E-ORDER-${runId}`;

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('1. admin creates a product in Master data', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('ชื่อสินค้า').fill(productName);
  await page.getByRole('textbox', { name: 'SKU' }).fill(skuCode);
  await page.getByRole('button', { name: 'เพิ่ม' }).click();
  await expect(page.locator('[role="cell"], [role="gridcell"]', { hasText: skuCode })).toBeVisible();
});

test('2. staff creates an order for that product and marks it paid', async ({ page }) => {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'สั่งของใหม่' }).first().click();

  await selectMuiOption(page, 'แพลตฟอร์ม', /Shopee|SP/);
  await page.getByLabel('เลขออเดอร์ (จากแอพ)').fill(orderNo);
  await selectMuiOption(page, 'สินค้า', productName);
  await page.getByLabel('จำนวน').fill('5');
  await page.getByLabel('ราคา/ชิ้น').fill('89');
  await page.getByRole('button', { name: 'บันทึก' }).click();

  const orderRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(orderRow).toBeVisible();
  await expect(orderRow.getByText('สั่งแล้ว')).toBeVisible();

  await orderRow.getByRole('button', { name: 'จ่ายแล้ว' }).click();
  await expect(orderRow.getByText('จ่ายแล้ว (รอเบิก)')).toBeVisible();
});

test('3. scan-confirms arrival, which auto-creates the inventory lot', async ({ page }) => {
  await page.goto('/scan');
  await page.getByLabel('ค้นหาเลขออเดอร์ / tracking / ชื่อสินค้า').fill(orderNo);
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

  const itemCard = page.locator('.MuiCard-root', { hasText: productName });
  await expect(itemCard).toBeVisible();
  await itemCard.getByLabel('เลข tracking (สแกน/กรอกเอง)').fill(`TRACK-${runId}`);
  await itemCard.getByRole('button', { name: 'ยืนยันรับของ' }).click();

  await expect(page.getByText(`รับของ ${productName} เข้าคลังแล้ว`)).toBeVisible();
});

test('4. withdraws stock from the newly received lot', async ({ page }) => {
  await page.goto('/inventory');
  const inventoryRow = page.getByRole('row', { name: new RegExp(skuCode) });
  // Both "received" and "on hand" columns read 5 before any withdrawal — asserting the row
  // is visible at all is enough here; the real assertion is the post-withdrawal count below.
  await expect(inventoryRow).toBeVisible();

  // Expand master row to reveal lot actions
  const expandBtn = inventoryRow.getByRole('button', { name: 'ขยายรายละเอียด' });
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
  }
  await page.getByRole('button', { name: 'เบิกออก' }).first().click();
  await page.getByLabel('จำนวน').fill('2');
  await selectMuiOption(page, 'เหตุผล', 'ขาย');
  await page.getByRole('button', { name: 'เบิกออก' }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible();
  const updatedRow = page.getByRole('row', { name: new RegExp(skuCode) });
  await expect(updatedRow.locator('[role="cell"], [role="gridcell"]', { hasText: '3' })).toBeVisible();
});

test('5. requests, approves, and pays the reimbursement; order flips to Reimbursed', async ({ page }) => {
  await page.goto('/reimbursements');
  const eligibleRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(eligibleRow).toBeVisible();
  await eligibleRow.click();
  await page.getByRole('button', { name: 'ส่งคำขอเบิกเงิน' }).click();

  await expect(page.getByText('ส่งคำขอเบิกเงินแล้ว')).toBeVisible();
  const reimbursementRow = page.locator('tr, [role="row"]', { hasText: 'รอตรวจสอบ' }).first();
  await reimbursementRow.getByRole('button', { name: 'อนุมัติ' }).click();

  const approvedRow = page.locator('tr, [role="row"]', { hasText: 'อนุมัติแล้ว' }).first();
  await approvedRow.getByRole('button', { name: 'จ่ายเงิน' }).click();
  await expect(page.locator('tr, [role="row"]', { hasText: 'จ่ายแล้ว' }).first()).toBeVisible();

  await page.goto('/orders');
  const orderRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(orderRow.getByText('เบิกแล้ว')).toBeVisible();
});

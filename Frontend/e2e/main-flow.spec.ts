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
  await page.getByRole('button', { name: 'บันทึก' }).click();
  await expect(orderRow.getByText('จ่ายแล้ว (รอเบิก)')).toBeVisible();
});

test('3. scan-confirms arrival, which auto-creates the inventory lot', async ({ page }) => {
  await page.goto('/scan');
  await page.getByLabel('เลข Order', { exact: true }).fill(orderNo);
  await page.getByRole('button', { name: 'ค้นหา Order', exact: true }).click();

  const orderRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(orderRow).toBeVisible();
  await orderRow.getByRole('button', { name: 'ขยายรายละเอียด' }).click();

  // The detail panel pre-fills "มาถึงรอบนี้" with the full remaining quantity per item,
  // so receiving everything is just confirming — no per-item tracking field in this flow.
  await expect(page.getByText(`รายการสินค้าใน Order ${orderNo}`)).toBeVisible();
  await page.getByRole('button', { name: /^บันทึกรับเข้าคลัง/ }).click();

  await expect(page.getByText(/รับสินค้า .* เข้าคลังแล้ว/)).toBeVisible();
});

test('4. withdraws stock from the newly received lot', async ({ page }) => {
  await page.goto('/inventory');
  const inventoryRow = page.getByRole('row', { name: new RegExp(skuCode) });
  // Both "received" and "on hand" columns read 5 before any withdrawal — asserting the row
  // is visible at all is enough here; the real assertion is the post-withdrawal count below.
  await expect(inventoryRow).toBeVisible();

  // Expand master row to reveal lot actions — the detail panel is a separate DataGrid
  // row in the DOM (not nested under the master row), so scope by its own accessible
  // name (`aria-label="ล็อตสินค้า SKU {skuCode}"` on the lot table) rather than a
  // page-wide "first() เบิกออก button", which would hit whichever SKU's panel happens
  // to be expanded first if more than one is open (e.g. leftover rows from prior runs).
  const expandBtn = inventoryRow.getByRole('button', { name: 'ขยายรายละเอียด' });
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
  }
  const lotTable = page.getByRole('table', { name: `ล็อตสินค้า SKU ${skuCode}` });
  await expect(lotTable).toBeVisible();
  await lotTable.getByRole('button', { name: 'เบิกออก' }).first().click();
  await page.getByLabel('จำนวน').fill('2');
  await selectMuiOption(page, 'เหตุผล', 'ขาย');
  await page.getByRole('button', { name: 'เบิกออก' }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible();
  const updatedRow = page.getByRole('row', { name: new RegExp(skuCode) });
  await expect(updatedRow.locator('[data-field="qtyOnHand"]')).toHaveText('3');
});

test('5. requests, approves, and pays the reimbursement; order flips to Reimbursed', async ({ page }) => {
  await page.goto('/reimbursements');
  const eligibleRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(eligibleRow).toBeVisible();
  // AppDataGrid's checkboxSelection only toggles via the checkbox cell itself —
  // clicking elsewhere in the row doesn't flip selection (unlike the old plain table).
  await eligibleRow.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'ส่งคำขอเบิกเงิน' }).click();

  await expect(page.getByText('ส่งคำขอเบิกเงินแล้ว')).toBeVisible();
  // Scoped by orderNo rather than an unscoped "first() row with this status text" —
  // accumulated leftover rows from prior E2E runs share the same status labels, so an
  // unscoped .first() can silently act on someone else's reimbursement request.
  const requestRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(requestRow.getByText('รอตรวจสอบ')).toBeVisible();
  await requestRow.getByRole('button', { name: 'อนุมัติ' }).click();

  await expect(requestRow.getByText('อนุมัติแล้ว')).toBeVisible();
  await requestRow.getByRole('button', { name: 'จ่ายเงิน' }).click();
  await expect(requestRow.getByText('จ่ายแล้ว')).toBeVisible();

  await page.goto('/orders');
  const orderRow = page.getByRole('row', { name: new RegExp(orderNo) });
  await expect(orderRow.getByText('เบิกแล้ว')).toBeVisible();
});

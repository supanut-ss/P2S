import type { Page } from '@playwright/test';

export async function login(page: Page, username = 'admin', password = 'ChangeMe123!') {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await page.waitForURL('/');
}

/**
 * MUI's `<TextField select>` renders a combobox button, not a native <select> — clicking it
 * opens a role="listbox" portal, and the option is a role="option" item inside that, not a
 * child of the field itself.
 */
export async function selectMuiOption(page: Page, labelText: string, optionText: string | RegExp) {
  await page.getByLabel(labelText).click();
  await page.getByRole('option', { name: optionText }).click();
}

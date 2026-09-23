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
 * child of the field itself. Scoped to role="combobox" with an exact name rather than
 * page.getByLabel(labelText) (substring match by default) — a plain label match on e.g.
 * "สินค้า" also catches any nearby aria-label containing that word as a substring (row
 * action buttons and the like), which is exactly the kind of thing that breaks silently as
 * the surrounding UI grows.
 */
export async function selectMuiOption(page: Page, labelText: string, optionText: string | RegExp) {
  await page.getByRole('combobox', { name: labelText, exact: true }).click();
  await page.getByRole('option', { name: optionText }).click();
}

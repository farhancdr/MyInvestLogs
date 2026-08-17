import { test, expect } from '@playwright/test';

/** Unique per run so repeated runs against a warm database stay independent. */
const unique = (prefix: string) => `${prefix} ${Date.now().toString().slice(-6)}`;

test('a business, an investment and a transaction can be recorded end to end', async ({ page }) => {
  const businessName = unique('E2E Ventures');
  const investmentName = unique('E2E round');

  await page.goto('/#/businesses');

  await page.getByRole('button', { name: 'Add business' }).click();
  await page.getByLabel('Business name').fill(businessName);
  await page.getByLabel('Industry').fill('Testing');
  await page.getByRole('button', { name: 'Save business' }).click();
  await expect(page.getByText('Business added')).toBeVisible();

  await page.goto('/#/investments');
  await page.getByRole('button', { name: 'Add investment' }).click();

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: businessName }).click();

  await page.getByLabel('Investment name').fill(investmentName);
  await page.getByLabel('Amount').fill('500000');
  await page.getByLabel('Promised annual return %').fill('20');

  // The review panel must agree with what the server will compute. Scoped to
  // the dialog: these figures also appear in the table behind it.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('৳100,000')).toBeVisible();
  await expect(dialog.getByText('৳600,000')).toBeVisible();

  await page.getByRole('button', { name: 'Save investment' }).click();
  await expect(page.getByText('Investment recorded')).toBeVisible();

  // Lands on the detail page, where the opening transaction already exists.
  await expect(page.getByRole('heading', { name: investmentName })).toBeVisible();
  await expect(page.getByText('Initial investment', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Record transaction' }).first().click();
  await page.getByLabel('Amount').fill('25000');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText('Transaction recorded')).toBeVisible();
});

test('the opening investment is written as a transaction, not a special case', async ({ page }) => {
  await page.goto('/#/transactions');
  await page.getByPlaceholder('Search reference or notes…').fill('Initial investment');
  await expect(page.locator('tbody tr').first()).toContainText('Investment');
});

test('a future-dated transaction is rejected with a reason', async ({ page }) => {
  await page.goto('/#/transactions');
  await page.getByRole('button', { name: 'Record transaction' }).first().click();

  await page.getByLabel('Date').fill('2099-01-01');
  await page.getByLabel('Amount').fill('1000');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByText('Date cannot be in the future.')).toBeVisible();
});

test('a zero amount is rejected', async ({ page }) => {
  await page.goto('/#/transactions');
  await page.getByRole('button', { name: 'Record transaction' }).first().click();

  await page.getByLabel('Amount').fill('0');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByText(/Amount must be greater than zero/)).toBeVisible();
});

test('voiding writes a reversing adjustment and keeps the original', async ({ page }) => {
  await page.goto('/#/transactions');
  await page.getByPlaceholder('Search reference or notes…').fill('Profit distribution');

  const firstRow = page.locator('tbody tr').first();
  const originalId = (await firstRow.locator('td').nth(1).textContent())!.trim();

  page.once('dialog', (dialog) => dialog.accept('e2e verification'));
  await firstRow.getByRole('button', { name: 'Void' }).click();
  await expect(page.getByText('Reversing adjustment written')).toBeVisible();

  // The original survives, and a decrease adjustment now points at it.
  await page.getByPlaceholder('Search reference or notes…').fill(originalId);
  await expect(page.getByText(originalId, { exact: false }).first()).toBeVisible();

  await page.getByPlaceholder('Search reference or notes…').fill(`Void of ${originalId}`);
  await expect(page.locator('tbody tr').first()).toContainText('Adjustment');
  await expect(page.locator('tbody tr').first()).toContainText('Decrease');
});

test('adjustments cannot themselves be voided', async ({ page }) => {
  await page.goto('/#/transactions');
  await page.getByRole('combobox').filter({ hasText: 'All types' }).click();
  await page.getByRole('option', { name: 'Adjustment' }).click();

  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.locator('tbody tr').first().getByRole('button', { name: 'Void' })).toHaveCount(0);
});

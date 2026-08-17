import { test, expect, type Page } from '@playwright/test';
import { resetSampleData } from './reset.ts';

const summary = (page: Page, label: string) =>
  page.locator(`[data-summary="${label}"] [data-summary-value]`);

// Every file starts from identical sample data.
test.beforeAll(resetSampleData);

test('an investment detail page separates principal from profit', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Import cycle 2025' }).click();

  await expect(page.getByRole('heading', { name: 'Import cycle 2025' })).toBeVisible();

  // Ran its full term and settled: 100,000 deployed, 100,000 principal back,
  // 24,000 profit. Total received is 124,000 but the gain is only 24,000 —
  // the distinction spreadsheets get wrong.
  await expect(summary(page, 'Initial investment')).toHaveText('৳100,000');
  await expect(summary(page, 'Principal returned')).toHaveText('৳100,000');
  await expect(summary(page, 'Profit received')).toHaveText('৳24,000');
  await expect(summary(page, 'Total received')).toHaveText('৳124,000');
  await expect(summary(page, 'Capital outstanding')).toHaveText('৳0');
});

test('a defaulted investment shows its capital written off', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Workshop equipment lease' }).click();

  await expect(page.getByText(/Capital written off/)).toBeVisible();
  await expect(summary(page, 'Capital outstanding')).toHaveText('৳0');
  // Status alone changes no number; the Loss transaction is what did this.
  await expect(page.getByText('Loss').first()).toBeVisible();
});

test('profit-share investments show N/A rather than a fabricated expectation', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Cold chain trade cycle' }).click();

  await expect(
    page.getByText(/Profit Share investments have no computable expected return/),
  ).toBeVisible();
  await expect(page.getByText('Expected vs actual')).toHaveCount(0);
});

test('a fixed-return investment compares expected against actual', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Inventory round' }).click();

  await expect(page.getByText('Expected vs actual')).toBeVisible();
  // 200,000 at 19% a year over a 24-month term: 76,000 across the whole term.
  await expect(summary(page, 'Expected at term')).toHaveText('৳76,000');
  await expect(page.getByText('Variance')).toBeVisible();
});

test('expected profit spans the whole term, not one year of it', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Inventory round' }).click();

  // 200,000 at 19% a year over 24 months is 76,000 in total. Reporting one
  // year's 38,000 understated every term that was not exactly twelve months.
  await expect(summary(page, 'Expected at term')).toHaveText('৳76,000');

  // Part-way through the term, the accrued figure sits below the full total.
  const byNow = await summary(page, 'Expected by now').textContent();
  expect(byNow).not.toBe('৳76,000');
});

test('the payout cycle is recorded and shown separately from the rate', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Inventory round' }).click();

  await expect(page.getByText('Every 6 months')).toBeVisible();
  // 19% a year on 200,000, handed over twice a year: 19,000 each time.
  await expect(page.getByText(/৳19,000 due every payout, 2× a year/)).toBeVisible();
});

test('security held is recorded against the investment', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Eco resort build' }).click();

  // The land deed is the real security on this one, alongside a partnership.
  await expect(page.getByText('Security held')).toBeVisible();
  await expect(page.getByText('Deed', { exact: true })).toBeVisible();
  await expect(page.getByText('Partnership', { exact: true })).toBeVisible();
});

test('a business carries the details needed to send money', async ({ page }) => {
  await page.goto('/#/businesses');
  await page.getByRole('cell', { name: 'Bengal Export House' }).click();

  await expect(page.getByText('Where to send money')).toBeVisible();
  await expect(page.getByText(/Routing: 060671726/)).toBeVisible();
  await expect(page.getByText('SME', { exact: true })).toBeVisible();
});

test('a business page rolls up its investments and links back', async ({ page }) => {
  await page.goto('/#/businesses');
  await page.getByRole('cell', { name: 'Tasnia Knitwear' }).click();

  await expect(page.getByRole('heading', { name: 'Tasnia Knitwear' })).toBeVisible();
  // Two rounds into the same business, rolled up: 500,000 + 250,000.
  await expect(summary(page, 'Total invested')).toHaveText('৳750,000');

  await expect(page.getByRole('cell', { name: 'Machinery import round' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Second import cycle' })).toBeVisible();
});

test('navigation reaches every top-level screen', async ({ page }) => {
  await page.goto('/');

  for (const [label, heading] of [
    ['Businesses', 'Businesses'],
    ['Investments', 'Investments'],
    ['Transactions', 'Transactions'],
    ['Dashboard', 'Portfolio'],
  ] as const) {
    await page.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }
});

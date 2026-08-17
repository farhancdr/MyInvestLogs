import { test, expect, type Page } from '@playwright/test';
import { resetSampleData } from './reset.ts';

const summary = (page: Page, label: string) =>
  page.locator(`[data-summary="${label}"] [data-summary-value]`);

// Every file starts from identical sample data.
test.beforeAll(resetSampleData);

test('an investment detail page separates principal from profit', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Bengal — machinery expansion' }).click();

  await expect(page.getByRole('heading', { name: 'Bengal — machinery expansion' })).toBeVisible();

  // 800,000 deployed, 200,000 principal back, 90,000 profit — total received is
  // 290,000 but profit is only 90,000, which is the distinction that matters.
  await expect(summary(page, 'Initial investment')).toHaveText('৳800,000');
  await expect(summary(page, 'Principal returned')).toHaveText('৳200,000');
  await expect(summary(page, 'Profit received')).toHaveText('৳90,000');
  await expect(summary(page, 'Total received')).toHaveText('৳290,000');
  await expect(summary(page, 'Capital outstanding')).toHaveText('৳600,000');
});

test('a defaulted investment shows its capital written off', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Jamuna — stock financing' }).click();

  await expect(page.getByText(/Capital written off/)).toBeVisible();
  await expect(summary(page, 'Capital outstanding')).toHaveText('৳0');
  // Status alone changes no number; the Loss transaction is what did this.
  await expect(page.getByText('Loss').first()).toBeVisible();
});

test('profit-share investments show N/A rather than a fabricated expectation', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Meghna — working capital' }).click();

  await expect(
    page.getByText(/Profit Share investments have no computable expected return/),
  ).toBeVisible();
  await expect(page.getByText('Expected vs actual')).toHaveCount(0);
});

test('a fixed-return investment compares expected against actual', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Padma — second round' }).click();

  await expect(page.getByText('Expected vs actual')).toBeVisible();
  // 300,000 at 20% over a 12-month term: 60,000, and the term is fully elapsed.
  await expect(summary(page, 'Expected at term')).toHaveText('৳60,000');
  await expect(summary(page, 'Expected by now')).toHaveText('৳60,000');
  await expect(page.getByText('Variance')).toBeVisible();
});

test('expected profit spans the whole term, not one year of it', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Bengal — machinery expansion' }).click();

  // 800,000 at 15% a year over 24 months is 240,000 in total. Reporting one
  // year's 120,000 understated every term that was not exactly twelve months.
  await expect(summary(page, 'Expected at term')).toHaveText('৳240,000');

  // Part-way through the term, the accrued figure sits below the full total.
  const byNow = await summary(page, 'Expected by now').textContent();
  expect(byNow).not.toBe('৳240,000');
});

test('the payout cycle is recorded and shown separately from the rate', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Bengal — machinery expansion' }).click();

  await expect(page.getByText('Every 6 months')).toBeVisible();
  // 15% a year on 800,000, handed over twice a year: 60,000 each time.
  await expect(page.getByText(/৳60,000 due every payout, 2× a year/)).toBeVisible();
});

test('security held is recorded against the investment', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('cell', { name: 'Bengal — machinery expansion' }).click();

  await expect(page.getByText('Security held')).toBeVisible();
  await expect(page.getByText('Deed', { exact: true })).toBeVisible();
  await expect(page.getByText('Partnership', { exact: true })).toBeVisible();
});

test('a business carries the details needed to send money', async ({ page }) => {
  await page.goto('/#/businesses');
  await page.getByRole('cell', { name: 'Bengal Textiles' }).click();

  await expect(page.getByText('Where to send money')).toBeVisible();
  await expect(page.getByText(/Routing: 060671726/)).toBeVisible();
  await expect(page.getByText('Established', { exact: true })).toBeVisible();
});

test('a business page rolls up its investments and links back', async ({ page }) => {
  await page.goto('/#/businesses');
  await page.getByRole('cell', { name: 'Padma Restaurant' }).click();

  await expect(page.getByRole('heading', { name: 'Padma Restaurant' })).toBeVisible();
  await expect(summary(page, 'Total invested')).toHaveText('৳800,000');

  // Both Padma investments are listed under the business.
  await expect(page.getByRole('cell', { name: 'Padma — opening round' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Padma — second round' })).toBeVisible();
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

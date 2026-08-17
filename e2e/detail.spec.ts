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
  await expect(summary(page, 'Expected profit')).toHaveText('৳60,000');
  await expect(page.getByText('Variance')).toBeVisible();
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

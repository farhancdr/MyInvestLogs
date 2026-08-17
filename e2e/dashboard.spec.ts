import { test, expect, type Page } from '@playwright/test';
import { resetSampleData } from './reset.ts';

/**
 * Asserted against the seeded sample set, whose totals are fixed: all its
 * dates are in the past, so the figures below do not drift over time.
 */
const kpi = (page: Page, label: string) =>
  page.locator(`[data-kpi="${label}"] [data-kpi-value]`);

// Every file starts from identical sample data.
test.beforeAll(resetSampleData);

test.beforeEach(async ({ page }) => {
  await page.goto('/#/dashboard');
  await expect(kpi(page, 'Total Invested')).toBeVisible();
});

test('portfolio KPIs match the transaction history', async ({ page }) => {
  await expect(kpi(page, 'Total Invested')).toHaveText('৳2,670,000');
  await expect(kpi(page, 'Total Received')).toHaveText('৳728,820');
  await expect(kpi(page, 'Profit Earned')).toHaveText('৳502,120');
  await expect(kpi(page, 'Capital Outstanding')).toHaveText('৳2,450,000');
  await expect(kpi(page, 'Realized ROI')).toHaveText('18.8%');
});

test('realized ROI is labelled so its denominator is not guessed at', async ({ page }) => {
  await expect(page.getByText('on total capital deployed')).toBeVisible();
});

test('all four charts render', async ({ page }) => {
  for (const title of [
    'Portfolio Over Time', 'Monthly Cash Flow', 'Allocation by Industry', 'Monthly Profit',
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  // Recharts draws into SVG; three chart panels plus icons.
  expect(await page.locator('.recharts-surface').count()).toBeGreaterThanOrEqual(3);
});

test('allocation is weighted by outstanding capital, so written-off capital drops out', async ({ page }) => {
  const allocation = page.locator('div').filter({ hasText: /^Allocation by Industry/ }).first();
  await expect(allocation).toContainText('Textiles');
  await expect(allocation).toContainText('Retail');
  // Gariyal Auto was written off and Ahmed Motors settled, so their industry
  // holds nothing and drops out entirely.
  await expect(allocation).not.toContainText('Transport & Logistics');
});

test('investment table sorts by a clicked column', async ({ page }) => {
  const firstCell = page.locator('tbody tr').first().locator('td').first();

  await page.getByRole('columnheader', { name: /Outstanding/ }).click();
  const descending = await firstCell.textContent();

  await page.getByRole('columnheader', { name: /Outstanding/ }).click();
  const ascending = await firstCell.textContent();

  expect(descending).not.toEqual(ascending);
});

test('search narrows the investment table', async ({ page }) => {
  const rows = page.locator('tbody tr');
  const before = await rows.count();

  // Tasnia Knitwear holds two rounds, so the name matches exactly two rows.
  await page.getByPlaceholder('Search investments…').fill('Tasnia');
  await expect(rows).toHaveCount(2);
  expect(before).toBeGreaterThan(2);
});

test('filtering by return model keeps only that model', async ({ page }) => {
  await page.getByRole('combobox').filter({ hasText: 'All return models' }).click();
  await page.getByRole('option', { name: 'Profit Share' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Karnaphuli');
});

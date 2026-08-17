import { test, expect } from '@playwright/test';
import { resetSampleData } from './reset.ts';

// Every file starts from identical sample data.
test.beforeAll(resetSampleData);

test.describe('health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/health');
    await expect(page.getByRole('heading', { name: 'Health', level: 1 })).toBeVisible();
  });

  test('reports concentration above the configured limit', async ({ page }) => {
    await expect(page.getByText('Concentrated in one business')).toBeVisible();
    await expect(page.getByText(/above your 30% limit/).first()).toBeVisible();
  });

  test('reports an investment past maturity with capital outstanding', async ({ page }) => {
    // Two investments are past maturity, so this title appears more than once.
    await expect(page.getByText('Past maturity with capital outstanding').first()).toBeVisible();
  });

  test('reports capital that has never been valued', async ({ page }) => {
    await expect(page.getByText('Never valued').first()).toBeVisible();
  });

  test('every issue carries an action, not just a complaint', async ({ page }) => {
    const rows = page.locator('li').filter({ hasText: /Critical|Warning|Review/ });
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(rows.first()).toContainText(/Record|Check|Confirm|Direct/);
  });

  test('an issue links through to the investment it concerns', async ({ page }) => {
    await page.getByRole('button', { name: 'Open' }).first().click();
    await expect(page).toHaveURL(/#\/(investment|business)\//);
  });
});

test.describe('allocation targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/targets');
    await expect(page.getByRole('heading', { name: 'Allocation targets' })).toBeVisible();
  });

  test('shows actual weight against the seeded target', async ({ page }) => {
    const row = page.locator('tbody tr').filter({ hasText: 'Food & Beverage' });
    await expect(row).toContainText('৳800,000');
    // 800k of 2.4M outstanding is 33.3% against a 30% target: over by 3.3pp,
    // which is inside the ±5pp band.
    await expect(row).toContainText('33.3%');
    await expect(row).toContainText('On target');
  });

  test('flags a holding outside the tolerance band', async ({ page }) => {
    // Import & Export holds 600k of 2.4M = 25% against a 15% target: +10pp.
    const row = page.locator('tbody tr').filter({ hasText: 'Import & Export' });
    await expect(row).toContainText('Over');
    await expect(row).toContainText(/shed/);
  });

  test('rejects targets that add up to more than the portfolio', async ({ page }) => {
    const inputs = page.locator('tbody tr input[type="number"]');
    await inputs.first().fill('90');
    await inputs.nth(1).fill('90');
    await page.getByRole('button', { name: 'Save targets' }).click();

    await expect(page.getByText(/more than the portfolio/)).toBeVisible();
  });

  test('saves an edited target and recomputes drift', async ({ page }) => {
    const row = page.locator('tbody tr').filter({ hasText: 'Food & Beverage' });
    await row.locator('input[type="number"]').fill('10');
    await page.getByRole('button', { name: 'Save targets' }).click();

    await expect(page.getByText('Targets saved')).toBeVisible();
    // 33.3% actual against a 10% target is well outside the band.
    await expect(row).toContainText('Over');
  });

  test('switches between industry and business scope', async ({ page }) => {
    await page.getByRole('tab', { name: 'By business' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: 'Padma Restaurant' })).toBeVisible();
    // No business targets are seeded, so everything is untargeted.
    await expect(page.getByText('No target').first()).toBeVisible();
  });
});

test.describe('valuations', () => {
  test('shows valuation history and unrealized P&L', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Padma — opening round' }).click();

    await expect(page.getByText('Valuation', { exact: true })).toBeVisible();
    // Marked at 560,000 against 500,000 outstanding: 60,000 unrealized.
    await expect(page.locator('[data-summary="Estimated value"]')).toContainText('৳560,000');
    await expect(page.locator('[data-summary="Unrealized P&L"]')).toContainText('৳60,000');
    await expect(page.getByText('Second outlet opened')).toBeVisible();
  });

  test('records a new valuation', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Karnaphuli — fleet share' }).click();

    await page.getByRole('button', { name: 'Update valuation' }).click();
    await page.getByLabel('Estimated value').fill('310000');
    await page.getByRole('button', { name: 'Record valuation' }).click();

    await expect(page.getByText('Valuation recorded')).toBeVisible();
    await expect(page.locator('[data-summary="Estimated value"]')).toContainText('৳310,000');
    // 310,000 against 250,000 outstanding.
    await expect(page.locator('[data-summary="Unrealized P&L"]')).toContainText('৳60,000');
  });

  test('refuses a future-dated valuation', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Meghna — working capital' }).click();

    await page.getByRole('button', { name: 'Update valuation' }).click();
    await page.getByLabel('As of').fill('2099-01-01');
    await page.getByLabel('Estimated value').fill('700000');
    await page.getByRole('button', { name: 'Record valuation' }).click();

    await expect(page.getByText(/cannot be dated in the future/)).toBeVisible();
  });

  test('unrealized P&L is kept out of realized ROI', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Padma — opening round' }).click();

    // Realized ROI counts only money received: 174,000 profit on 500,000.
    await expect(page.locator('[data-summary="Realized ROI"]')).toContainText('34.8%');
  });
});

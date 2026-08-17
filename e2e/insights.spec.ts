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
    // Two rounds into Tasnia Knitwear put it at 30.6% of outstanding capital.
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
    // Retail holds 500k of 2.45M outstanding: 20.4% against a 25% target, which
    // is inside the ±5pp band.
    const row = page.locator('tbody tr').filter({ hasText: 'Retail' });
    await expect(row).toContainText('৳500,000');
    await expect(row).toContainText('20.4%');
    await expect(row).toContainText('On target');
  });

  test('flags a holding outside the tolerance band', async ({ page }) => {
    // Two rounds into one knitwear business put Textiles at 34.7% of
    // outstanding capital against a 15% target — nearly 20pp over.
    const row = page.locator('tbody tr').filter({ hasText: 'Textiles' });
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
    const row = page.locator('tbody tr').filter({ hasText: 'Retail' });
    await row.locator('input[type="number"]').fill('5');
    await page.getByRole('button', { name: 'Save targets' }).click();

    await expect(page.getByText('Targets saved')).toBeVisible();
    // 20.4% actual against a 5% target is well outside the band.
    await expect(row).toContainText('Over');
  });

  test('switches between industry and business scope', async ({ page }) => {
    await page.getByRole('tab', { name: 'By business' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: 'Tasnia Knitwear' })).toBeVisible();
    // No business targets are seeded, so everything is untargeted.
    await expect(page.getByText('No target').first()).toBeVisible();
  });
});

test.describe('valuations', () => {
  test('shows valuation history and unrealized P&L', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Eco resort build' }).click();

    await expect(page.getByText('Valuation', { exact: true })).toBeVisible();
    // Marked at 300,000 against 250,000 outstanding: 50,000 unrealized.
    await expect(page.locator('[data-summary="Estimated value"]')).toContainText('৳300,000');
    await expect(page.locator('[data-summary="Unrealized P&L"]')).toContainText('৳50,000');
    await expect(page.getByText(/Six cottages complete/)).toBeVisible();
  });

  test('records a new valuation', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Fulfilment expansion' }).click();

    await page.getByRole('button', { name: 'Update valuation' }).click();
    await page.getByLabel('Estimated value').fill('260000');
    await page.getByRole('button', { name: 'Record valuation' }).click();

    await expect(page.getByText('Valuation recorded')).toBeVisible();
    await expect(page.locator('[data-summary="Estimated value"]')).toContainText('৳260,000');
    // 260,000 against 200,000 outstanding.
    await expect(page.locator('[data-summary="Unrealized P&L"]')).toContainText('৳60,000');
  });

  test('refuses a future-dated valuation', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Cold chain trade cycle' }).click();

    await page.getByRole('button', { name: 'Update valuation' }).click();
    await page.getByLabel('As of').fill('2099-01-01');
    await page.getByLabel('Estimated value').fill('700000');
    await page.getByRole('button', { name: 'Record valuation' }).click();

    await expect(page.getByText(/cannot be dated in the future/)).toBeVisible();
  });

  test('unrealized P&L is kept out of realized ROI', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Machinery import round' }).click();

    // Realized ROI counts only money received: 185,200 profit on 500,000. The
    // 40,000 mark-up sits beside it, never inside it.
    await expect(page.locator('[data-summary="Realized ROI"]')).toContainText('37.0%');
  });
});

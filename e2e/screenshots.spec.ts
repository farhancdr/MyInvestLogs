import { test, expect } from '@playwright/test';

/**
 * Captures the README images. Not an assertion suite — it exists so the
 * screenshots are regenerated from the real app rather than drifting out of
 * date, and so they always show the same sample data.
 *
 *   npx playwright test e2e/screenshots.spec.ts
 */
const shot = (name: string, theme: 'light' | 'dark') =>
  `docs/images/${name}${theme === 'dark' ? '-dark' : ''}.png`;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test(`dashboard — ${theme}`, async ({ page }) => {
      await page.goto('/#/dashboard');
      await expect(page.locator('[data-kpi="Total Invested"]')).toBeVisible();
      // Let the chart animations settle before capturing.
      await page.waitForTimeout(1200);
      await page.screenshot({ path: shot('dashboard', theme), fullPage: true });
    });

    test(`investment detail — ${theme}`, async ({ page }) => {
      await page.goto('/#/investments');
      await page.getByRole('cell', { name: 'Bengal — machinery expansion' }).click();
      await expect(page.getByText('Expected vs actual')).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: shot('investment-detail', theme), fullPage: true });
    });
  });
}

test('businesses list', async ({ page }) => {
  await page.goto('/#/businesses');
  await expect(page.getByRole('cell', { name: 'Padma Restaurant' })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('businesses', 'light'), fullPage: true });
});

test('transactions ledger', async ({ page }) => {
  await page.goto('/#/transactions');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('transactions', 'light'), fullPage: true });
});

test('add investment dialog with live review', async ({ page }) => {
  await page.goto('/#/investments');
  await page.getByRole('button', { name: 'Add investment' }).click();

  await page.getByLabel('Investment name').fill('Third round');
  await page.getByLabel('Amount').fill('500000');
  await page.getByLabel('Promised annual return %').fill('20');
  await expect(page.getByRole('dialog').getByText('৳600,000')).toBeVisible();

  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('add-investment', 'light') });
});

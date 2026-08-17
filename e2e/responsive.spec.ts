import { test, expect } from '@playwright/test';
import { resetSampleData } from './reset.ts';

// Every file starts from identical sample data.
test.beforeAll(resetSampleData);

const PHONE = { width: 390, height: 844 };

test.describe('theme', () => {
  test('defaults to following the system setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/#/dashboard');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('an explicit choice overrides the system and survives a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/#/dashboard');

    const theme = page.getByRole('group', { name: 'Theme' });
    await theme.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

    // The stored choice must win over the OS preference after a reload.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('returning to system hands control back to the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/#/dashboard');

    const theme = page.getByRole('group', { name: 'Theme' });
    await theme.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await theme.getByRole('button', { name: 'System' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: PHONE });

  test('the theme control is reachable on a phone', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page.getByRole('group', { name: 'Theme' })).toBeVisible();
  });

  test('navigation moves into a drawer', async ({ page }) => {
    await page.goto('/#/dashboard');

    // The desktop strip is hidden; the links live behind the menu button.
    await expect(page.getByRole('link', { name: 'Transactions' })).toBeHidden();

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Health' }).click();

    await expect(page.getByRole('heading', { name: 'Health', level: 1 })).toBeVisible();
  });

  test('no page scrolls sideways', async ({ page }) => {
    for (const path of [
      '/#/dashboard', '/#/businesses', '/#/investments',
      '/#/transactions', '/#/targets', '/#/health',
    ]) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // Wide tables scroll inside their own container, never the page.
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test('a detail page stays readable on a phone', async ({ page }) => {
    await page.goto('/#/investments');
    await page.getByRole('cell', { name: 'Machinery import round' }).click();

    await expect(page.locator('[data-summary="Realized ROI"]')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the transaction dialog fits the screen', async ({ page }) => {
    await page.goto('/#/transactions');
    await page.getByRole('button', { name: 'Record transaction' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(PHONE.width);
  });
});

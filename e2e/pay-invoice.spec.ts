import { test, expect } from '@playwright/test';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';

test.describe('Pay invoice flow', () => {
  test('invoice detail page renders with pay button', async ({ page }) => {
    const invoicePage = new InvoiceDetailPage(page);
    await invoicePage.goto('1');

    await page.waitForLoadState('networkidle');
    await expect(invoicePage.heading).toBeVisible();
    await expect(invoicePage.payButton).toBeVisible();
  });

  test('funding progress bar is visible', async ({ page }) => {
    const invoicePage = new InvoiceDetailPage(page);
    await invoicePage.goto('1');

    await page.waitForLoadState('networkidle');
    await expect(invoicePage.fundingProgress).toBeVisible();
  });
});

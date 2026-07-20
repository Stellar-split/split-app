import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';

test.describe('Landing page', () => {
  test('loads and CTA navigates to /invoice/new', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();

    await expect(landing.createInvoiceCta).toBeVisible();
    await expect(landing.createInvoiceCta).toHaveAttribute('href', '/invoice/new');

    await landing.clickCreateInvoice();
    await expect(page).toHaveURL(/\/invoice\/new/);
  });
});

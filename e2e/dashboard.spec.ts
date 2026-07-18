import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Dashboard', () => {
  test('dashboard loads with heading', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await page.waitForLoadState('networkidle');
    await expect(dashboard.heading).toBeVisible();
  });

  test('shows sent and received invoices', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await page.waitForLoadState('networkidle');
    const hasCards = await dashboard.invoiceCards.count();
    const hasEmpty = await dashboard.emptyState.isVisible().catch(() => false);
    expect(hasCards > 0 || hasEmpty).toBe(true);
  });
});

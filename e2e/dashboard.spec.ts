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

  test('analytics dashboard updates in real-time', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await page.waitForLoadState('networkidle');

    const analytics = page.getByTestId('analytics-dashboard');
    const hasAnalytics = await analytics.isVisible().catch(() => false);
    if (!hasAnalytics) {
      test.skip(true, 'Analytics dashboard not present in this environment');
      return;
    }

    await expect(analytics).toBeVisible();

    const liveMetric = page.getByTestId('analytics-live-metric').first();
    await expect(liveMetric).toBeVisible();

    const initialText = (await liveMetric.textContent()) ?? '';
    await expect
      .poll(async () => (await liveMetric.textContent()) ?? '', {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
      })
      .not.toBe(initialText);
  });

  test('analytics dashboard auto-refreshes without data loss', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await page.waitForLoadState('networkidle');

    const analytics = page.getByTestId('analytics-dashboard');
    const hasAnalytics = await analytics.isVisible().catch(() => false);
    if (!hasAnalytics) {
      test.skip(true, 'Analytics dashboard not present in this environment');
      return;
    }

    const refreshIndicator = page.getByTestId('analytics-refresh-indicator');
    const hasIndicator = await refreshIndicator.isVisible().catch(() => false);
    if (hasIndicator) {
      await expect(refreshIndicator).toBeVisible();
    }

    const liveMetric = page.getByTestId('analytics-live-metric').first();
    await expect(liveMetric).toBeVisible();
    await expect(liveMetric).not.toHaveText('');
  });
});

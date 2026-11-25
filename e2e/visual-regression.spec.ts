import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateInvoicePage } from './pages/CreateInvoicePage';

/**
 * Visual regression suite.
 *
 * Uses Playwright's built-in screenshot comparison (`toHaveScreenshot`) as
 * the visual regression tool: it ships with the E2E stack already in this
 * repo, so no extra service/dependency is needed. Baselines are written on
 * first run (or via `npx playwright test --update-snapshots`) to
 * `e2e/visual-regression.spec.ts-snapshots/` and are committed so CI can
 * diff future runs against them. The acceptable diff threshold is
 * configured centrally in `playwright.config.ts` (`expect.toHaveScreenshot`)
 * — currently a 20% per-pixel color threshold and a 2% overall differing
 * pixel ratio, chosen to tolerate font/anti-aliasing noise across CI
 * environments without masking real visual regressions.
 */
test.describe('Visual regression @visual', () => {
  test('landing page baseline', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await expect(landing.createInvoiceCta).toBeVisible();

    await expect(page).toHaveScreenshot('landing-page.png', { fullPage: true });
  });

  test('dashboard page baseline', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.heading).toBeVisible();

    await expect(page).toHaveScreenshot('dashboard-page.png', { fullPage: true });
  });

  test('create invoice form baseline', async ({ page }) => {
    const createInvoice = new CreateInvoicePage(page);
    await createInvoice.goto();
    await expect(createInvoice.heading).toBeVisible();

    await expect(page).toHaveScreenshot('create-invoice-page.png', { fullPage: true });
  });

  test('create invoice form - recipient input component', async ({ page }) => {
    const createInvoice = new CreateInvoicePage(page);
    await createInvoice.goto();
    await expect(createInvoice.recipientInput).toBeVisible();

    await expect(createInvoice.recipientInput).toHaveScreenshot('recipient-input.png');
  });
});

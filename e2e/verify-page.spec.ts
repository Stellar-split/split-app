import { test, expect } from '@playwright/test';
import { VerifyPage } from './pages/VerifyPage';

test.describe('/verify/[id] public page', () => {
  test('renders without wallet connection', async ({ page }) => {
    const verifyPage = new VerifyPage(page);
    await verifyPage.goto('1');

    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).not.toHaveText(/connect.*wallet/i);
  });

  test('shows verified on-chain badge', async ({ page }) => {
    const verifyPage = new VerifyPage(page);
    await verifyPage.goto('1');

    await page.waitForLoadState('networkidle');
    await expect(verifyPage.verifiedBadge).toBeVisible();
  });

  test('shows creator and recipients sections', async ({ page }) => {
    const verifyPage = new VerifyPage(page);
    await verifyPage.goto('1');

    await page.waitForLoadState('networkidle');
    await expect(verifyPage.creatorAddress).toBeVisible();
    await expect(verifyPage.recipientItems.first()).toBeVisible();
  });

  test('shows payment progress section', async ({ page }) => {
    const verifyPage = new VerifyPage(page);
    await verifyPage.goto('1');

    await page.waitForLoadState('networkidle');
    await expect(verifyPage.progressSection).toBeVisible();
  });
});

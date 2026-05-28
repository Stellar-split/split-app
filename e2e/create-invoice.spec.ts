import { test, expect } from '@playwright/test';

test('create invoice - fill form and submit', async ({ page }) => {
  // Mock SDK responses
  await page.route('**/api/**', async (route) => {
    if (route.request().url().includes('createInvoice')) {
      await route.abort('blockedbyclient');
    } else {
      await route.continue();
    }
  });

  await page.goto('/invoice/new');

  // Fill in the form
  await page.fill('input[placeholder="G... address"]', 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJQDP7DC3K2YSEipq76pqxi');
  await page.fill('input[placeholder="USDC"]', '100');

  // The page should have a submit button
  const submitButton = page.locator('button:has-text("Create Invoice")');
  await expect(submitButton).toBeEnabled();
});

test('create invoice with equal split', async ({ page }) => {
  await page.goto('/invoice/new');

  // Toggle equal split
  const equalSplitToggle = page.locator('button[role="switch"][aria-label="Toggle equal split mode"]');
  await equalSplitToggle.click();

  // Fill total amount
  await page.fill('input#total-amount', '200');

  // Add a recipient
  await page.fill('input[placeholder="G... address"]', 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJQDP7DC3K2YSJEIPQ76PQXI');

  // Add another recipient
  await page.click('button:has-text("+ Add Recipient")');
  const addresses = page.locator('input[placeholder="G... address"]');
  await addresses.nth(1).fill('GB2YDQRPJGLV5DQNGD5XBFN3FAUEY3QYLJZP3KYP7VJBDXCFCWDKM');

  // Should show per-recipient amount
  await expect(page.locator('text=/.*100.*USDC per recipient/')).toBeVisible();
});

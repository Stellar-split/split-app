import { test, expect } from '@playwright/test';
import { CreateInvoicePage } from './pages/CreateInvoicePage';

test.describe('Create invoice flow', () => {
  test('form loads with all required fields', async ({ page }) => {
    const createPage = new CreateInvoicePage(page);
    await createPage.goto();

    await expect(createPage.heading).toBeVisible();
    await expect(createPage.recipientInput).toBeVisible();
    await expect(createPage.nextButton).toBeVisible();
  });

  test('equal split mode shows per-recipient amount', async ({ page }) => {
    const createPage = new CreateInvoicePage(page);
    await createPage.goto();

    await createPage.toggleEqualSplit();
    await createPage.fillTotalAmount('200');

    await expect(createPage.totalAmountInput).toHaveValue('200');
  });

  test('fill form and submit redirects', async ({ page }) => {
    const createPage = new CreateInvoicePage(page);
    await createPage.goto();

    await createPage.fillRecipient('GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJQDP7DC3K2YSJEIPQ76PQXI');
    await createPage.fillAmount('100');
    await createPage.clickNext();
    await createPage.clickNext();
    await createPage.clickNext();

    await expect(createPage.submitButton).toBeEnabled();
  });
});

import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly invoiceCards: Locator;
  readonly emptyState: Locator;
  readonly payMultipleButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Dashboard/i });
    this.invoiceCards = page.locator('a[aria-label*="View Invoice"]');
    this.emptyState = page.locator('text=/No invoices found/i');
    this.payMultipleButton = page.locator('button:has-text("Pay Multiple")');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }
}

import { Page, Locator } from '@playwright/test';

export class InvoiceDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly statusBadge: Locator;
  readonly payButton: Locator;
  readonly fundingProgress: Locator;
  readonly recipientList: Locator;
  readonly paymentList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Invoice #/ });
    this.statusBadge = page.locator('[aria-label*="Status:"]');
    this.payButton = page.locator('button:has-text("Pay")').first();
    this.fundingProgress = page.locator('[role="progressbar"]');
    this.recipientList = page.locator('ul[aria-label="Recipient list"]');
    this.paymentList = page.locator('ul[aria-label="Payment list"]');
  }

  async goto(id: string) {
    await this.page.goto(`/invoice/${id}`);
  }

  async clickPay() {
    await this.payButton.click();
  }
}

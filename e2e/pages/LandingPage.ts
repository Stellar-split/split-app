import { Page, Locator } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly createInvoiceCta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createInvoiceCta = page.locator('a[href="/invoice/new"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async clickCreateInvoice() {
    await this.createInvoiceCta.click();
  }
}

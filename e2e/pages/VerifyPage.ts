import { Page, Locator } from '@playwright/test';

export class VerifyPage {
  readonly page: Page;
  readonly verifiedBadge: Locator;
  readonly fundedBadge: Locator;
  readonly statusText: Locator;
  readonly creatorAddress: Locator;
  readonly recipientItems: Locator;
  readonly paymentItems: Locator;
  readonly progressSection: Locator;
  readonly payButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.verifiedBadge = page.locator('text=Verified on-chain');
    this.fundedBadge = page.locator('text=% funded');
    this.statusText = page.locator('[aria-label*="Status:"]');
    this.creatorAddress = page.locator('section[aria-labelledby="verify-creator-heading"]');
    this.recipientItems = page.locator('section[aria-labelledby="verify-recipients-heading"] li');
    this.paymentItems = page.locator('section[aria-labelledby="verify-payments-heading"] li');
    this.progressSection = page.locator('section[aria-labelledby="verify-progress-heading"]');
    this.payButton = page.locator('button:has-text("Pay")');
  }

  async goto(id: string) {
    await this.page.goto(`/verify/${id}`);
  }
}

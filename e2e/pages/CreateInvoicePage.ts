import { Page, Locator } from '@playwright/test';

export class CreateInvoicePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly recipientInput: Locator;
  readonly amountInput: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;
  readonly equalSplitToggle: Locator;
  readonly totalAmountInput: Locator;
  readonly addRecipientButton: Locator;
  readonly tokenInput: Locator;
  readonly deadlineDaysInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Create Invoice/i });
    this.recipientInput = page.locator('input[placeholder="G... address"]');
    this.amountInput = page.locator('input[placeholder="USDC"]');
    this.nextButton = page.locator('button:has-text("Next")');
    this.backButton = page.locator('button:has-text("Back")');
    this.submitButton = page.locator('button[type="submit"]');
    this.equalSplitToggle = page.locator('button[role="switch"][aria-label="Toggle equal split mode"]');
    this.totalAmountInput = page.locator('input#total-amount');
    this.addRecipientButton = page.locator('button:has-text("+ Add Recipient")');
    this.tokenInput = page.locator('input[placeholder*="C"]');
    this.deadlineDaysInput = page.locator('input[type="number"]').first();
  }

  async goto() {
    await this.page.goto('/invoice/new');
  }

  async fillRecipient(address: string) {
    await this.recipientInput.fill(address);
  }

  async fillAmount(amount: string) {
    await this.amountInput.fill(amount);
  }

  async fillTotalAmount(amount: string) {
    await this.totalAmountInput.fill(amount);
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  async submit() {
    await this.submitButton.click();
  }

  async toggleEqualSplit() {
    await this.equalSplitToggle.click();
  }

  async addRecipient() {
    await this.addRecipientButton.click();
  }
}

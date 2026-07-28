import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated WCAG 2.1 AA accessibility gate.
 *
 * Run with: npx playwright test --grep @a11y
 *
 * `/subscriptions` from the original audit scope does not exist as a route in
 * this app and is intentionally omitted — see docs/ACCESSIBILITY.md.
 */

const PAGES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'Home' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/invoice/new', name: 'New Invoice' },
  { path: '/invoice/1', name: 'Invoice Detail' },
  { path: '/verify/1', name: 'Verify Invoice' },
  { path: '/analytics', name: 'Analytics' },
];

async function runAxe(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

function formatViolations(violations: import('axe-core').Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    - ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, '\n      ')}`).join('\n');
      return `[${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})\n${nodes}`;
    })
    .join('\n\n');
}

for (const { path, name } of PAGES) {
  test(`@a11y ${name} (${path}) has no critical or serious axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const results = await runAxe(page);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousOrCritical, formatViolations(seriousOrCritical)).toEqual([]);
  });
}

test('@a11y Home mobile nav menu is keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const menuButton = page.getByRole('button', { name: /open menu/i });
  await expect(menuButton).toBeVisible();

  await menuButton.focus();
  await expect(menuButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();

  const results = await runAxe(page);
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  expect(seriousOrCritical, formatViolations(seriousOrCritical)).toEqual([]);
});

test('@a11y New Invoice form fields are all keyboard-reachable and labelled', async ({ page }) => {
  await page.goto('/invoice/new');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(page.getByLabel(/token address|token contract address/i)).toBeVisible();

  const results = await runAxe(page);
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  expect(seriousOrCritical, formatViolations(seriousOrCritical)).toEqual([]);
});

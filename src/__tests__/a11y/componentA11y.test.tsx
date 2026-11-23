import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render } from "@testing-library/react";
import axe from "axe-core";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

/**
 * Component-level automated accessibility testing.
 *
 * Complements the page-level WCAG gate in e2e/a11y.spec.ts (Playwright +
 * @axe-core/playwright) with fast, isolated axe-core scans of individual
 * components under jsdom. Catches ARIA/role/labelling regressions in a
 * single component without needing a full page render or a browser.
 *
 * See docs/ACCESSIBILITY.md for the full automated + manual testing process.
 */

async function expectNoSeriousOrCriticalViolations(container: Element) {
  const results = await axe.run(container, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  });
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  expect(seriousOrCritical).toEqual([]);
}

describe("component accessibility (axe-core)", () => {
  it("StatusBadge has no critical/serious a11y violations", async () => {
    const { container } = render(<StatusBadge status="Active" />);
    await expectNoSeriousOrCriticalViolations(container);
  });

  it("StatusBadge remains accessible for every status variant", async () => {
    const statuses = ["Pending", "Active", "Funded", "Released", "Refunded", "Disputed", "Frozen", "Archived", "Expired"] as const;
    for (const status of statuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      await expectNoSeriousOrCriticalViolations(container);
      unmount();
    }
  });

  it("Skeleton primitive has no a11y violations", async () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    await expectNoSeriousOrCriticalViolations(container);
  });

  it("SkeletonCard has no a11y violations", async () => {
    const { container } = render(<SkeletonCard />);
    await expectNoSeriousOrCriticalViolations(container);
  });
});

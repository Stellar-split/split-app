import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render } from "@testing-library/react";
import StatusBadge from "@/components/StatusBadge";

/**
 * Snapshot tests catch unintended rendering changes to shared components.
 * See docs/SNAPSHOT_TESTING.md for the review/update process.
 */
describe("StatusBadge snapshots", () => {
  it("renders the default (md) size", () => {
    const { container } = render(<StatusBadge status="Active" />);
    expect(container).toMatchSnapshot();
  });

  it("renders the sm size", () => {
    const { container } = render(<StatusBadge status="Pending" size="sm" />);
    expect(container).toMatchSnapshot();
  });

  it("renders the lg size with a custom description", () => {
    const { container } = render(
      <StatusBadge status="Disputed" size="lg" description="Under active dispute review" />
    );
    expect(container).toMatchSnapshot();
  });
});

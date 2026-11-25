import { vi, describe, it, beforeEach, afterEach, expect } from "vitest";
/**
 * Unit tests for CooldownBadge.
 *
 * Covers:
 *  - renders a countdown when expiresAt is in the future
 *  - renders nothing when expiresAt is null
 *  - renders nothing when expiresAt is in the past (expired)
 *  - ticks down by 1 second after each interval
 *  - has the required ARIA attributes for screen-reader announcements
 *  - reacts to expiry timestamp transitions (null -> future, active -> null)
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import CooldownBadge from "@/components/CooldownBadge";

const NOW = new Date("2024-01-01T00:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const futureExpiry = () => Math.floor(Date.now() / 1000) + 16_212; // ~4h 30m 12s

test("renders countdown when expiresAt is in the future", () => {
  render(<CooldownBadge expiresAt={futureExpiry()} />);
  expect(screen.getByRole("status")).toBeTruthy() // element exists in DOM;
  expect(screen.getByRole("status").textContent).toMatch(/Next payment in/);
});

test("renders nothing when expiresAt is null", () => {
  const { container } = render(<CooldownBadge expiresAt={null} />);
  expect(container.firstChild).toBeNull();
});

test("renders nothing when expiresAt is already expired", () => {
  const past = Math.floor(Date.now() / 1000) - 1;
  const { container } = render(<CooldownBadge expiresAt={past} />);
  expect(container.firstChild).toBeNull();
});

test("has role=status and aria-live=polite", () => {
  render(<CooldownBadge expiresAt={futureExpiry()} />);
  const badge = screen.getByRole("status");
  expect(badge.getAttribute("aria-live")).toBe("polite");
  expect(badge.getAttribute("aria-atomic")).toBe("true");
});

test("countdown text updates after 1 second tick", () => {
  const expiry = Math.floor(Date.now() / 1000) + 65; // 1m 05s
  render(<CooldownBadge expiresAt={expiry} />);

  const before = screen.getByRole("status").textContent ?? "";
  expect(before).toContain("Next payment in 1m 05s");

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  const after = screen.getByRole("status").textContent ?? "";
  expect(after).not.toBe(before);
  expect(after).toContain("Next payment in 1m 04s");
});

test("clears (renders nothing) once the expiry timestamp passes", () => {
  const expiry = Math.floor(Date.now() / 1000) + 2; // expires in 2 s
  const { container } = render(<CooldownBadge expiresAt={expiry} />);

  expect(container.firstChild).not.toBeNull();

  act(() => {
    vi.advanceTimersByTime(2000);
  });

  expect(container.firstChild).toBeNull();
});

test("shows the badge when expiresAt changes from null to a future timestamp", () => {
  const { container, rerender } = render(<CooldownBadge expiresAt={null} />);
  expect(container.firstChild).toBeNull();

  rerender(<CooldownBadge expiresAt={futureExpiry()} />);
  expect(screen.getByRole("status")).toBeTruthy();
});

test("hides the badge when an active expiry changes to null", () => {
  const { container, rerender } = render(<CooldownBadge expiresAt={futureExpiry()} />);
  expect(container.firstChild).not.toBeNull();

  rerender(<CooldownBadge expiresAt={null} />);
  expect(container.firstChild).toBeNull();
});

test("uses the new timestamp when an active deadline is replaced", () => {
  const { rerender } = render(<CooldownBadge expiresAt={futureExpiry()} />);
  expect(screen.getByRole("status").textContent).toContain("4h 30m 12s");

  rerender(<CooldownBadge expiresAt={Math.floor(Date.now() / 1000) + 125} />);
  expect(screen.getByRole("status").textContent).toContain("Next payment in 2m 05s");
});

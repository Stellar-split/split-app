/**
 * Unit tests for CooldownBadge.
 *
 * Covers:
 *  - renders a countdown when expiresAt is in the future
 *  - renders nothing when expiresAt is null
 *  - renders nothing when expiresAt is in the past (expired)
 *  - ticks down by 1 second after each interval
 *  - has the required ARIA attributes for screen-reader announcements
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import CooldownBadge from "@/components/CooldownBadge";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const futureExpiry = () => Math.floor(Date.now() / 1000) + 16_212; // ~4h 30m 12s

test("renders countdown when expiresAt is in the future", () => {
  render(<CooldownBadge expiresAt={futureExpiry()} />);
  expect(screen.getByRole("status")).toBeInTheDocument();
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
  expect(badge).toHaveAttribute("aria-live", "polite");
  expect(badge).toHaveAttribute("aria-atomic", "true");
});

test("countdown text updates after 1 second tick", () => {
  const expiry = Math.floor(Date.now() / 1000) + 65; // 1m 05s
  render(<CooldownBadge expiresAt={expiry} />);

  const before = screen.getByRole("status").textContent ?? "";

  act(() => {
    jest.advanceTimersByTime(1000);
  });

  const after = screen.getByRole("status").textContent ?? "";
  expect(after).not.toBe(before);
});

test("clears (renders nothing) once the expiry timestamp passes", () => {
  const expiry = Math.floor(Date.now() / 1000) + 2; // expires in 2 s
  const { container } = render(<CooldownBadge expiresAt={expiry} />);

  expect(container.firstChild).not.toBeNull();

  act(() => {
    jest.advanceTimersByTime(3000); // advance past expiry
  });

  expect(container.firstChild).toBeNull();
});

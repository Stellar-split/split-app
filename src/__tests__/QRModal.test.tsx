/**
 * Unit tests for QRModal polling (#211).
 *
 * Covers:
 *  - onConnected fires exactly once when wallet connects
 *  - polling stops (no extra calls) after connection detected
 *  - polling stops when open becomes false
 *  - no interval leak across open/close cycles
 *  - pollingInterval prop controls the delay
 */

import React from "react";
import { render, act } from "@testing-library/react";
import QRModal from "@/components/QRModal";

// ── mock isWalletConnected ────────────────────────────────────────────────────
const mockIsWalletConnected = jest.fn();
jest.mock("@/lib/freighter", () => ({
  isWalletConnected: (...args: unknown[]) => mockIsWalletConnected(...args),
}));

// ── mock FocusTrap (renders children) ────────────────────────────────────────
jest.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── mock qrcode.react ─────────────────────────────────────────────────────────
jest.mock("qrcode.react", () => ({
  QRCodeCanvas: () => <canvas />,
}));

const baseProps = {
  open: true,
  uri: "wc:test-uri",
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  mockIsWalletConnected.mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test("onConnected fires exactly once when wallet connects", async () => {
  const onConnected = jest.fn();
  mockIsWalletConnected.mockResolvedValue(true);

  render(<QRModal {...baseProps} onConnected={onConnected} pollingInterval={2000} />);

  await act(async () => {
    jest.advanceTimersByTime(2000);
  });

  expect(onConnected).toHaveBeenCalledTimes(1);
});

test("onConnected does not fire again if connection stays true", async () => {
  const onConnected = jest.fn();
  mockIsWalletConnected.mockResolvedValue(true);

  render(<QRModal {...baseProps} onConnected={onConnected} pollingInterval={2000} />);

  // Advance tick-by-tick so the async callback resolves and sets firedRef before the next tick
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
  }

  expect(onConnected).toHaveBeenCalledTimes(1);
});

test("onConnected does not fire while wallet not connected", async () => {
  const onConnected = jest.fn();
  mockIsWalletConnected.mockResolvedValue(false);

  render(<QRModal {...baseProps} onConnected={onConnected} pollingInterval={2000} />);

  await act(async () => {
    jest.advanceTimersByTime(6000); // 3 ticks, never connected
  });

  expect(onConnected).not.toHaveBeenCalled();
});

test("polling stops when open becomes false", async () => {
  const onConnected = jest.fn();
  mockIsWalletConnected.mockResolvedValue(false);

  const { rerender } = render(
    <QRModal {...baseProps} onConnected={onConnected} pollingInterval={2000} />
  );

  // close modal
  rerender(
    <QRModal {...baseProps} open={false} onConnected={onConnected} pollingInterval={2000} />
  );

  // wallet connects, but modal is closed
  mockIsWalletConnected.mockResolvedValue(true);

  await act(async () => {
    jest.advanceTimersByTime(6000);
  });

  expect(onConnected).not.toHaveBeenCalled();
});

test("no interval leak: re-opening fires onConnected exactly once per cycle", async () => {
  const onConnected = jest.fn();

  // First open: wallet not connected
  const { rerender } = render(
    <QRModal {...baseProps} onConnected={onConnected} pollingInterval={2000} />
  );

  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(onConnected).toHaveBeenCalledTimes(0);

  // Close modal
  rerender(
    <QRModal {...baseProps} open={false} onConnected={onConnected} pollingInterval={2000} />
  );

  // Re-open, wallet now connected
  mockIsWalletConnected.mockResolvedValue(true);
  rerender(
    <QRModal {...baseProps} open={true} onConnected={onConnected} pollingInterval={2000} />
  );

  await act(async () => {
    jest.advanceTimersByTime(2000);
  });

  // Should fire exactly once for the new cycle, not multiple times from leaked intervals
  expect(onConnected).toHaveBeenCalledTimes(1);
});

test("pollingInterval prop controls tick frequency", async () => {
  const onConnected = jest.fn();
  mockIsWalletConnected.mockResolvedValue(true);

  render(<QRModal {...baseProps} onConnected={onConnected} pollingInterval={500} />);

  // Should not have fired before 500ms
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(onConnected).toHaveBeenCalledTimes(0);

  await act(async () => {
    jest.advanceTimersByTime(100); // reaches 500ms
  });
  expect(onConnected).toHaveBeenCalledTimes(1);
});

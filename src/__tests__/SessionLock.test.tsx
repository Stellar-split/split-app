import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { SessionLockProvider, useSessionLock } from "@/contexts/SessionLockContext";

function TestConsumer() {
  const { locked, timeoutMinutes, setTimeoutMinutes, resume } = useSessionLock();
  return (
    <div>
      <span data-testid="locked">{String(locked)}</span>
      <span data-testid="timeout">{String(timeoutMinutes)}</span>
      <button data-testid="resume" onClick={resume}>Resume</button>
      <button data-testid="set-5" onClick={() => setTimeoutMinutes(5)}>Set 5</button>
      <button data-testid="set-null" onClick={() => setTimeoutMinutes(null)}>Disable</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("starts unlocked", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );
  expect(screen.getByTestId("locked").textContent).toBe("false");
});

test("defaults timeout to 15 minutes", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );
  expect(screen.getByTestId("timeout").textContent).toBe("15");
});

test("locks after inactivity timeout", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );

  act(() => {
    jest.advanceTimersByTime(15 * 60 * 1000 + 15_000);
  });

  expect(screen.getByTestId("locked").textContent).toBe("true");
});

test("interaction resets the timer", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );

  act(() => {
    jest.advanceTimersByTime(14 * 60 * 1000);
  });
  expect(screen.getByTestId("locked").textContent).toBe("false");

  fireEvent.mouseDown(document);

  act(() => {
    jest.advanceTimersByTime(14 * 60 * 1000);
  });
  expect(screen.getByTestId("locked").textContent).toBe("false");
});

test("resume unlocks the session", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );

  act(() => {
    jest.advanceTimersByTime(16 * 60 * 1000);
  });
  expect(screen.getByTestId("locked").textContent).toBe("true");

  fireEvent.click(screen.getByTestId("resume"));
  expect(screen.getByTestId("locked").textContent).toBe("false");
});

test("disabled state (null timeout) skips locking entirely", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );

  fireEvent.click(screen.getByTestId("set-null"));

  act(() => {
    jest.advanceTimersByTime(120 * 60 * 1000);
  });

  expect(screen.getByTestId("locked").textContent).toBe("false");
});

test("changing timeout persists to localStorage", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );

  fireEvent.click(screen.getByTestId("set-5"));
  expect(localStorage.getItem("stellarsplit_session_lock_timeout")).toBe("5");
});

test("lock overlay shows Resume button", () => {
  render(
    <SessionLockProvider>
      <TestConsumer />
    </SessionLockProvider>,
  );

  act(() => {
    jest.advanceTimersByTime(16 * 60 * 1000);
  });

  expect(screen.getByText("Session Locked")).toBeInTheDocument();
  expect(screen.getAllByText("Resume").length).toBeGreaterThanOrEqual(1);
});

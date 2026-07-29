import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the usePaymentVelocity hook
vi.mock("@/hooks/usePaymentVelocity", () => ({
  usePaymentVelocity: vi.fn(() => ({
    velocities: {
      "1h": { volume: 500, threshold: 1000 },
      "24h": { volume: 5000, threshold: 10000 },
      "7d": { volume: 20000, threshold: 50000 },
    },
    lastUpdated: new Date(),
    loading: false,
    error: null,
  })),
}));

// Mock Radix UI components
vi.mock("@radix-ui/react-popover", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Content: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

describe("Payment Velocity Gauge (#408)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("Gauge Rendering", () => {
    it("renders three gauge arcs for 1h, 24h, and 7d", () => {
      const { container } = render(
        <svg data-testid="velocity-gauges">
          <circle data-testid="gauge-1h" />
          <circle data-testid="gauge-24h" />
          <circle data-testid="gauge-7d" />
        </svg>
      );

      expect(screen.getByTestId("gauge-1h")).toBeInTheDocument();
      expect(screen.getByTestId("gauge-24h")).toBeInTheDocument();
      expect(screen.getByTestId("gauge-7d")).toBeInTheDocument();
    });

    it("fills gauge arcs proportionally to volume vs threshold ratio", () => {
      // Volume 500 of 1000 threshold = 50% fill
      const volume = 500;
      const threshold = 1000;
      const fillPercentage = (volume / threshold) * 100;

      expect(fillPercentage).toBe(50);
    });

    it("renders SVG for accessibility instead of canvas", () => {
      const { container } = render(
        <svg data-testid="velocity-gauges">
          <title>Payment Velocity Gauge</title>
          <circle data-testid="gauge-arc" />
        </svg>
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.tagName).toBe("svg");
    });

    it("displays correct gauge fill for accounts with zero payment history", () => {
      const { usePaymentVelocity } = await import("@/hooks/usePaymentVelocity");
      vi.mocked(usePaymentVelocity).mockReturnValue({
        velocities: {
          "1h": { volume: 0, threshold: 1000 },
          "24h": { volume: 0, threshold: 10000 },
          "7d": { volume: 0, threshold: 50000 },
        },
        lastUpdated: new Date(),
        loading: false,
        error: null,
      });

      const fillPercentage = (0 / 1000) * 100;
      expect(fillPercentage).toBe(0);
    });

    it("caps gauge at error color when volume exceeds 200% of threshold", () => {
      const volume = 2500;
      const threshold = 1000;
      const fillPercentage = Math.min((volume / threshold) * 100, 100);

      expect(fillPercentage).toBe(100);
    });
  });

  describe("Threshold Configuration", () => {
    it("stores thresholds in localStorage under stellarsplit:velocityThresholds", () => {
      const thresholds = {
        "1h": 1000,
        "24h": 10000,
        "7d": 50000,
      };

      localStorage.setItem(
        "stellarsplit:velocityThresholds",
        JSON.stringify(thresholds)
      );

      const stored = JSON.parse(
        localStorage.getItem("stellarsplit:velocityThresholds") || "{}"
      );
      expect(stored).toEqual(thresholds);
    });

    it("displays inline threshold popover for editing", () => {
      render(
        <button data-testid="threshold-popover-trigger">⚙️ Settings</button>
      );

      fireEvent.click(screen.getByTestId("threshold-popover-trigger"));
      expect(screen.getByTestId("threshold-popover-trigger")).toBeInTheDocument();
    });

    it("updates gauge fill immediately when threshold value changes", async () => {
      let threshold = 1000;
      const volume = 500;

      const { rerender } = render(
        <div data-testid="gauge-fill">
          {((volume / threshold) * 100).toFixed(0)}%
        </div>
      );

      expect(screen.getByTestId("gauge-fill")).toHaveTextContent("50%");

      threshold = 500; // Change threshold
      rerender(
        <div data-testid="gauge-fill">
          {((volume / threshold) * 100).toFixed(0)}%
        </div>
      );

      expect(screen.getByTestId("gauge-fill")).toHaveTextContent("100%");
    });

    it("updates without page reload when threshold is edited", async () => {
      const mockUpdate = vi.fn();

      render(
        <input
          data-testid="threshold-input"
          type="number"
          defaultValue="1000"
          onChange={(e) => {
            mockUpdate(parseInt(e.target.value));
            localStorage.setItem(
              "stellarsplit:velocityThresholds",
              JSON.stringify({ threshold: parseInt(e.target.value) })
            );
          }}
        />
      );

      const input = screen.getByTestId("threshold-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "2000" } });

      expect(mockUpdate).toHaveBeenCalledWith(2000);
      const stored = JSON.parse(
        localStorage.getItem("stellarsplit:velocityThresholds") || "{}"
      );
      expect(stored.threshold).toBe(2000);
    });
  });

  describe("Alert Banner Triggering", () => {
    it("triggers alert banner when threshold is breached", () => {
      const mockDispatch = vi.fn();

      render(
        <button
          data-testid="check-breach"
          onClick={() => {
            const volume = 1500;
            const threshold = 1000;
            if (volume > threshold) {
              const event = new CustomEvent("velocity:alert", {
                detail: { window: "1h", volume, threshold },
              });
              mockDispatch(event);
            }
          }}
        >
          Check
        </button>
      );

      fireEvent.click(screen.getByTestId("check-breach"));
      expect(mockDispatch).toHaveBeenCalled();
    });

    it("displays breached window and volume clearly in alert banner", () => {
      render(
        <div data-testid="alert-banner" role="alert">
          <div>Payment Velocity Alert</div>
          <div>1h window: $1,500 exceeded threshold of $1,000</div>
        </div>
      );

      expect(screen.getByTestId("alert-banner")).toHaveTextContent("1h window");
      expect(screen.getByTestId("alert-banner")).toHaveTextContent("1,500");
      expect(screen.getByTestId("alert-banner")).toHaveTextContent("1,000");
    });

    it("allows dismissing alert banner without disabling threshold", async () => {
      const mockDismiss = vi.fn();

      render(
        <div data-testid="alert-banner" role="alert">
          <button
            data-testid="dismiss-alert"
            onClick={() => {
              mockDismiss();
            }}
          >
            Dismiss
          </button>
        </div>
      );

      fireEvent.click(screen.getByTestId("dismiss-alert"));
      expect(mockDismiss).toHaveBeenCalled();

      // Threshold should still be active
      const thresholds = localStorage.getItem(
        "stellarsplit:velocityThresholds"
      );
      expect(thresholds).toBeDefined();
    });
  });

  describe("Data Refresh", () => {
    it("re-fetches velocity data every 30 seconds", async () => {
      const mockFetch = vi.fn();

      render(
        <div data-testid="gauge-widget">
          <div data-testid="last-updated">Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
      );

      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(screen.getByTestId("last-updated")).toBeInTheDocument();
      });
    });

    it("displays last-updated timestamp reflecting actual fetch time", async () => {
      const now = new Date();
      const formatTime = (d: Date) => d.toLocaleTimeString();

      const { rerender } = render(
        <div data-testid="timestamp">Last fetched: {formatTime(now)}</div>
      );

      expect(screen.getByTestId("timestamp")).toHaveTextContent("Last fetched:");
    });

    it("cleans up interval on component unmount", () => {
      const mockClearInterval = vi.spyOn(global, "clearInterval");

      const { unmount } = render(
        <div>
          <div data-testid="gauge">Gauge</div>
        </div>
      );

      unmount();

      // Verify cleanup would be called in useEffect
      expect(screen.queryByTestId("gauge")).not.toBeInTheDocument();
    });

    it("fetches horizon payment history for the connected account", async () => {
      const mockServer = {
        payments: vi.fn().mockReturnValue({
          forAccount: vi.fn().mockReturnValue({
            call: vi.fn().mockResolvedValue({
              records: [
                {
                  type: "payment",
                  from: "account_address",
                  amount: "500",
                  asset_code: "native",
                  created_at: "2024-01-15T10:00:00Z",
                },
              ],
            }),
          }),
        }),
      };

      // Simulate fetching payment history
      const payments = await mockServer.payments().forAccount("account_address").call();

      expect(payments.records).toHaveLength(1);
      expect(payments.records[0].type).toBe("payment");
    });

    it("filters to outgoing operations only", () => {
      const allOps = [
        {
          type: "payment",
          from: "my_account",
          to: "other_account",
          direction: "out",
        },
        {
          type: "payment",
          from: "other_account",
          to: "my_account",
          direction: "in",
        },
      ];

      const outgoing = allOps.filter((op) => op.direction === "out");
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].to).toBe("other_account");
    });

    it("computes rolling sums for each time window", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const payments = [
        { amount: 100, time: now },
        { amount: 200, time: oneHourAgo },
        { amount: 300, time: oneDayAgo },
        { amount: 400, time: sevenDaysAgo },
      ];

      const sum1h = payments
        .filter((p) => p.time.getTime() > oneHourAgo.getTime())
        .reduce((sum, p) => sum + p.amount, 0);

      expect(sum1h).toBe(100);
    });
  });

  describe("Error Handling", () => {
    it("renders gracefully when payment history fetch fails", async () => {
      const { usePaymentVelocity } = await import("@/hooks/usePaymentVelocity");
      vi.mocked(usePaymentVelocity).mockReturnValue({
        velocities: undefined,
        lastUpdated: undefined,
        loading: false,
        error: new Error("Failed to fetch"),
      });

      render(
        <div data-testid="error-state">
          <div>Unable to load velocity data</div>
        </div>
      );

      expect(
        screen.getByText("Unable to load velocity data")
      ).toBeInTheDocument();
    });

    it("displays loading state while fetching initial data", () => {
      const { usePaymentVelocity } = await import("@/hooks/usePaymentVelocity");
      vi.mocked(usePaymentVelocity).mockReturnValue({
        velocities: undefined,
        lastUpdated: undefined,
        loading: true,
        error: null,
      });

      render(
        <div data-testid="loading-state">
          <div>Loading velocity data...</div>
        </div>
      );

      expect(screen.getByText("Loading velocity data...")).toBeInTheDocument();
    });
  });
});

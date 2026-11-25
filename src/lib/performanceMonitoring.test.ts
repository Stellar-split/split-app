import { describe, it, expect, vi, afterEach } from "vitest";
import {
  rateMetric,
  isRegression,
  onPerformanceMetric,
  PERFORMANCE_BUDGETS,
  initPerformanceMonitoring,
} from "./performanceMonitoring";

describe("performanceMonitoring", () => {
  describe("rateMetric", () => {
    it("rates LCP within budget as good", () => {
      expect(rateMetric("LCP", 1200)).toBe("good");
    });

    it("rates LCP between good and poor as needs-improvement", () => {
      expect(rateMetric("LCP", 3000)).toBe("needs-improvement");
    });

    it("rates LCP above the poor threshold as poor", () => {
      expect(rateMetric("LCP", 5000)).toBe("poor");
    });

    it("rates CLS using its own (unitless) budget", () => {
      expect(rateMetric("CLS", 0.05)).toBe("good");
      expect(rateMetric("CLS", 0.3)).toBe("poor");
    });
  });

  describe("isRegression", () => {
    it("flags a regression once a metric exceeds its poor threshold", () => {
      expect(isRegression("LCP", PERFORMANCE_BUDGETS.LCP.poor + 1)).toBe(true);
    });

    it("does not flag a metric within budget", () => {
      expect(isRegression("LCP", PERFORMANCE_BUDGETS.LCP.good)).toBe(false);
    });
  });

  describe("onPerformanceMetric", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("subscribes and unsubscribes reporters", () => {
      const reporter = vi.fn();
      const unsubscribe = onPerformanceMetric(reporter);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });

  describe("initPerformanceMonitoring", () => {
    it("is a no-op when PerformanceObserver is unavailable (SSR-safe)", () => {
      expect(() => initPerformanceMonitoring()).not.toThrow();
    });
  });
});

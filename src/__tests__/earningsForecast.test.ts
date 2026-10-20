import { forecastEarnings, forecastEarningsDetailed, totalForecast } from "@/lib/earningsForecast";

describe("forecastEarnings", () => {
  it("projects a linear trend", () => {
    const history = [10, 20, 30].map((v, i) => ({ label: `m${i}`, value: v }));
    const points = forecastEarnings(history, 2, ["a", "b"]);
    expect(points).toHaveLength(5);
    expect(points[2].forecast).toBe(30);
    expect(points[3]).toMatchObject({ label: "a", forecast: 40, low: 40, high: 40 });
    expect(points[4].forecast).toBe(50);
    expect(totalForecast(points)).toBe(90);
  });

  it("never projects negative earnings and widens the band", () => {
    const history = [10, 30, 20, 40].map((v, i) => ({ label: `m${i}`, value: v }));
    const points = forecastEarnings(history, 6);
    const future = points.filter((p) => p.actual === undefined);
    future.forEach((p) => expect(p.low!).toBeGreaterThanOrEqual(0));
    expect(future[5].high! - future[5].forecast!).toBeGreaterThan(future[0].high! - future[0].forecast!);
  });

  it("returns history unchanged when empty or no horizon", () => {
    expect(forecastEarnings([], 3)).toEqual([]);
    expect(forecastEarnings([{ label: "x", value: 1 }], 0)).toEqual([{ label: "x", actual: 1 }]);
  });

  it("evaluates candidate models using walk-forward error metrics", () => {
    const history = [10, 20, 30, 40, 50, 60, 70, 80].map((value, index) => ({ label: `m${index}`, value }));
    const result = forecastEarningsDetailed(history, 2);
    expect(result.model).toBe("linear");
    expect(result.metrics).toMatchObject({ mae: 0, rmse: 0, mape: 0, sampleCount: 5 });
    expect(result.points[8].low).toBe(result.points[8].forecast);
    expect(result.points[8].high).toBe(result.points[8].forecast);
    expect(Number.isNaN(Date.parse(result.trainedAt))).toBe(false);
  });

  it("selects the model with lower walk-forward error for noisy history", () => {
    const history = [10, 11, 10, 30, 10, 11, 10, 30, 10, 11, 10, 30].map((value, index) => ({ label: `m${index}`, value }));
    const result = forecastEarningsDetailed(history, 2);
    expect(result.model).toBe("moving-average");
    expect(result.metrics.sampleCount).toBe(9);
    expect(result.points.slice(-2).every((point) => point.low! <= point.forecast! && point.high! >= point.forecast!)).toBe(true);
    expect(result.points[13].high! - result.points[13].forecast!).toBeGreaterThan(result.points[12].high! - result.points[12].forecast!);
  });
});

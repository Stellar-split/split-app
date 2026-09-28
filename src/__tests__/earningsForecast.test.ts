import { forecastEarnings, totalForecast } from "@/lib/earningsForecast";

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
});

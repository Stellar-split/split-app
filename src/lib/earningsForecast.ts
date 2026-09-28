export interface EarningsPoint {
  /** Display label for the period (e.g. "Jan 25"). */
  label: string;
  /** Earnings for the period in USDC. */
  value: number;
}

export interface ForecastPoint {
  label: string;
  /** Historical value; undefined for projected periods. */
  actual?: number;
  /** Projected value; also set on the last actual point so the lines connect. */
  forecast?: number;
  /** Lower / upper bound of the confidence band for projected periods. */
  low?: number;
  high?: number;
}

/**
 * Forecast future earnings with an ordinary least-squares linear trend over
 * the historical series. The confidence band is ±1 residual standard deviation,
 * widening with distance from the last actual point. Values never go below 0.
 */
export function forecastEarnings(
  history: EarningsPoint[],
  periods: number,
  futureLabels: string[] = []
): ForecastPoint[] {
  const points: ForecastPoint[] = history.map((h) => ({ label: h.label, actual: h.value }));
  const n = history.length;
  if (n === 0 || periods <= 0) return points;

  const xs = history.map((_, i) => i);
  const ys = history.map((h) => h.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const residualVar =
    n > 2 ? ys.reduce((s, y, i) => s + (y - (intercept + slope * i)) ** 2, 0) / (n - 2) : 0;
  const sd = Math.sqrt(residualVar);

  const round = (v: number) => Math.round(Math.max(0, v) * 100) / 100;
  points[n - 1].forecast = points[n - 1].actual;

  for (let k = 1; k <= periods; k++) {
    const x = n - 1 + k;
    const value = intercept + slope * x;
    const spread = sd * Math.sqrt(k);
    points.push({
      label: futureLabels[k - 1] ?? `+${k}`,
      forecast: round(value),
      low: round(value - spread),
      high: round(value + spread),
    });
  }
  return points;
}

/** Sum of projected values across the forecast horizon. */
export function totalForecast(points: ForecastPoint[]): number {
  const total = points
    .filter((p) => p.actual === undefined)
    .reduce((s, p) => s + (p.forecast ?? 0), 0);
  return Math.round(total * 100) / 100;
}

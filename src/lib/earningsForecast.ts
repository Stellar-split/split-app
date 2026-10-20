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

export type ForecastModel = 'linear' | 'moving-average';

export interface ForecastMetrics {
  mae: number;
  rmse: number;
  mape: number | null;
  sampleCount: number;
}

export interface DetailedForecast {
  points: ForecastPoint[];
  model: ForecastModel;
  metrics: ForecastMetrics;
  trainedAt: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function linearPrediction(values: number[], x: number): { value: number; residualStdDev: number; meanX: number; sxx: number } {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;
  const sxx = values.reduce((sum, _, index) => sum + (index - meanX) ** 2, 0);
  const slope = sxx === 0
    ? 0
    : values.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0) / sxx;
  const intercept = meanY - slope * meanX;
  const residualVariance = n > 2
    ? values.reduce((sum, value, index) => sum + (value - (intercept + slope * index)) ** 2, 0) / (n - 2)
    : 0;
  return { value: intercept + slope * x, residualStdDev: Math.sqrt(residualVariance), meanX, sxx };
}

function movingAveragePrediction(values: number[], x: number): { value: number; residualStdDev: number } {
  const windowSize = Math.min(3, values.length);
  const recent = values.slice(-windowSize);
  const value = recent.reduce((sum, item) => sum + item, 0) / recent.length;
  const residuals = values.slice(windowSize).map((actual, index) => {
    const training = values.slice(0, windowSize + index);
    const window = training.slice(-windowSize);
    return actual - window.reduce((sum, item) => sum + item, 0) / window.length;
  });
  const residualVariance = residuals.length > 1
    ? residuals.reduce((sum, residual) => sum + residual ** 2, 0) / (residuals.length - 1)
    : 0;
  return { value, residualStdDev: Math.sqrt(residualVariance) * Math.sqrt(x) };
}

function predict(values: number[], x: number, model: ForecastModel, horizon = 1) {
  return model === 'linear' ? linearPrediction(values, x) : movingAveragePrediction(values, horizon);
}

function evaluateModel(values: number[], model: ForecastModel): ForecastMetrics {
  const errors: number[] = [];
  const percentages: number[] = [];
  for (let index = 3; index < values.length; index++) {
    const prediction = predict(values.slice(0, index), index, model, 1).value;
    const error = values[index] - prediction;
    errors.push(error);
    if (values[index] !== 0) percentages.push(Math.abs(error / values[index]) * 100);
  }
  const absoluteError = errors.reduce((sum, error) => sum + Math.abs(error), 0);
  const squaredError = errors.reduce((sum, error) => sum + error ** 2, 0);
  return {
    mae: errors.length ? round(absoluteError / errors.length) : 0,
    rmse: errors.length ? round(Math.sqrt(squaredError / errors.length)) : 0,
    mape: percentages.length ? round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null,
    sampleCount: errors.length,
  };
}

/**
 * Forecast future earnings with an ordinary least-squares linear trend over
 * the historical series. The confidence band is ±1 residual standard deviation,
 * widening with distance from the last actual point. Values never go below 0.
 */
export function forecastEarningsDetailed(
  history: EarningsPoint[],
  periods: number,
  futureLabels: string[] = []
): DetailedForecast {
  const points: ForecastPoint[] = history.map((h) => ({ label: h.label, actual: h.value }));
  const n = history.length;
  const linearMetrics = evaluateModel(history.map((item) => item.value), 'linear');
  const movingAverageMetrics = evaluateModel(history.map((item) => item.value), 'moving-average');
  const useMovingAverage = n >= 7 && movingAverageMetrics.mae < linearMetrics.mae;
  const model: ForecastModel = useMovingAverage ? 'moving-average' : 'linear';
  const metrics = useMovingAverage ? movingAverageMetrics : linearMetrics;

  if (n > 0 && periods > 0) {
    const values = history.map((item) => item.value);
    points[n - 1].forecast = points[n - 1].actual;
    for (let period = 1; period <= periods; period++) {
      const x = n - 1 + period;
      const result = predict(values, x, model, period);
      const spread = model === 'linear'
        ? 1.96 * result.residualStdDev * Math.sqrt(1 + 1 / n + (n > 1 ? (x - result.meanX) ** 2 / result.sxx : 0))
        : 1.96 * result.residualStdDev;
      const forecast = Math.max(0, result.value);
      points.push({
        label: futureLabels[period - 1] ?? `+${period}`,
        forecast: round(forecast),
        low: round(Math.max(0, forecast - spread)),
        high: round(forecast + spread),
      });
    }
  }

  return { points, model, metrics, trainedAt: new Date().toISOString() };
}

export function forecastEarnings(
  history: EarningsPoint[],
  periods: number,
  futureLabels: string[] = []
): ForecastPoint[] {
  return forecastEarningsDetailed(history, periods, futureLabels).points;
}

/** Sum of projected values across the forecast horizon. */
export function totalForecast(points: ForecastPoint[]): number {
  const total = points
    .filter((p) => p.actual === undefined)
    .reduce((s, p) => s + (p.forecast ?? 0), 0);
  return Math.round(total * 100) / 100;
}

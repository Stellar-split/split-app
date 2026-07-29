import { resolveRounding } from '@/hooks/useSplitCalculator';

describe('resolveRounding', () => {
  const STROOP_SCALE = 1e7;

  it('should resolve rounding for 3-recipient split', () => {
    const percentages = [33.33, 33.33, 33.34];
    const totalAmount = 100;

    const result = resolveRounding(percentages, totalAmount);

    expect(result.amounts).toHaveLength(3);
    const sumStroops = result.amounts.reduce(
      (s, a) => s + Math.round(a * STROOP_SCALE),
      0
    );
    const totalStroops = Math.round(totalAmount * STROOP_SCALE);
    expect(sumStroops).toBe(totalStroops);
  });

  it('should resolve rounding for 7-recipient split', () => {
    const percentages = [14.28, 14.28, 14.28, 14.28, 14.28, 14.29, 14.31];
    const totalAmount = 1000;

    const result = resolveRounding(percentages, totalAmount);

    expect(result.amounts).toHaveLength(7);
    const sumStroops = result.amounts.reduce(
      (s, a) => s + Math.round(a * STROOP_SCALE),
      0
    );
    const totalStroops = Math.round(totalAmount * STROOP_SCALE);
    expect(sumStroops).toBe(totalStroops);
  });

  it('should resolve rounding for 11-recipient split', () => {
    const percentages = Array(11)
      .fill(0)
      .map((_, i) => (i === 10 ? 9.1 : 9.09));
    const totalAmount = 5000;

    const result = resolveRounding(percentages, totalAmount);

    expect(result.amounts).toHaveLength(11);
    const sumStroops = result.amounts.reduce(
      (s, a) => s + Math.round(a * STROOP_SCALE),
      0
    );
    const totalStroops = Math.round(totalAmount * STROOP_SCALE);
    expect(sumStroops).toBe(totalStroops);
  });

  it('should assign adjustment to first recipient', () => {
    const percentages = [50, 50];
    const totalAmount = 100;

    const result = resolveRounding(percentages, totalAmount);

    expect(result.recipientIndex).toBe(0);
  });

  it('should return zero adjustment when no rounding needed', () => {
    const percentages = [25, 25, 25, 25];
    const totalAmount = 100;

    const result = resolveRounding(percentages, totalAmount);

    const sumStroops = result.amounts.reduce(
      (s, a) => s + Math.round(a * STROOP_SCALE),
      0
    );
    const totalStroops = Math.round(totalAmount * STROOP_SCALE);
    expect(sumStroops).toBe(totalStroops);
  });

  it('should handle fractional stroop amounts', () => {
    const percentages = [33.333, 33.333, 33.334];
    const totalAmount = 123.456789;

    const result = resolveRounding(percentages, totalAmount);

    const sumStroops = result.amounts.reduce(
      (s, a) => s + Math.round(a * STROOP_SCALE),
      0
    );
    const totalStroops = Math.round(totalAmount * STROOP_SCALE);
    expect(sumStroops).toBe(totalStroops);
  });
});

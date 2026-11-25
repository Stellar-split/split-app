export interface PredictionInput {
  target: number;
  raised: number;
  createdAt: string;
  deadline?: string;
  now?: number;
}

export interface PaymentPrediction {
  probability: number;
  estimatedCompletion: string | null;
  label: "likely" | "possible" | "unlikely";
}

/** Linear-velocity model: projects the current funding rate forward to the deadline. */
export function predictPayment(input: PredictionInput): PaymentPrediction {
  const now = input.now ?? Date.now();
  const { target, raised } = input;
  if (target <= 0 || raised >= target) {
    return { probability: 1, estimatedCompletion: new Date(now).toISOString(), label: "likely" };
  }
  const elapsed = Math.max(1, now - Date.parse(input.createdAt));
  const velocity = raised / elapsed;
  const estimatedCompletion = velocity > 0 ? new Date(now + (target - raised) / velocity).toISOString() : null;

  let probability: number;
  if (!input.deadline) {
    probability = velocity > 0 ? Math.min(0.95, 0.5 + raised / target / 2) : 0.1;
  } else {
    const remaining = Date.parse(input.deadline) - now;
    if (remaining <= 0) probability = 0;
    else probability = Math.min(1, (raised + velocity * remaining) / target);
  }
  probability = Math.round(probability * 100) / 100;
  const label = probability >= 0.75 ? "likely" : probability >= 0.4 ? "possible" : "unlikely";
  return { probability, estimatedCompletion, label };
}

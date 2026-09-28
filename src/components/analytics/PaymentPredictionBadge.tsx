import { predictPayment, type PredictionInput } from "@/lib/paymentPrediction";

const STYLES = {
  likely: "bg-green-100 text-green-800",
  possible: "bg-yellow-100 text-yellow-800",
  unlikely: "bg-red-100 text-red-800",
};

export default function PaymentPredictionBadge(props: PredictionInput) {
  const p = predictPayment(props);
  const eta = p.estimatedCompletion ? new Date(p.estimatedCompletion).toLocaleDateString() : "unknown";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[p.label]}`}
      title={`Estimated completion: ${eta}`}
    >
      {Math.round(p.probability * 100)}% {p.label} to be paid
    </span>
  );
}

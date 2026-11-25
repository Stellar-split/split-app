import { computeAccountabilityScore, type AccountabilityInput } from "@/lib/creatorAccountability";

const ROWS = [
  { key: "fulfillment", label: "Fulfilment", max: 50 },
  { key: "disputes", label: "Disputes", max: 30 },
  { key: "responsiveness", label: "Responsiveness", max: 20 },
] as const;

export default function CreatorAccountabilityScore({ stats }: { stats: AccountabilityInput }) {
  const { score, grade, breakdown } = computeAccountabilityScore(stats);

  if (score === null) {
    return (
      <section aria-label="Creator accountability score" className="w-full max-w-md rounded-lg border border-gray-200 p-4">
        <h2 className="text-base font-semibold">Accountability score</h2>
        <p className="mt-2 text-sm text-gray-500">Not enough invoice history to rate this creator yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Creator accountability score" className="w-full max-w-md rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Accountability score</h2>
        <span className="text-2xl font-bold" aria-label={`Grade ${grade}`}>
          {grade}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Accountability score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div className="h-full bg-indigo-600" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-1 text-sm text-gray-600">{score} / 100</p>
      <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
        {ROWS.map((r) => (
          <div key={r.key} className="flex justify-between gap-2 sm:block">
            <dt className="text-gray-500">{r.label}</dt>
            <dd className="font-medium">
              {breakdown[r.key]} / {r.max}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

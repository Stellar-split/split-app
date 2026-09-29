import { evaluateCertification, type CertificationInput, type CertificationLevel } from "@/lib/creatorCertification";

const LEVEL_STYLES: Record<CertificationLevel, string> = {
  none: "bg-gray-100 text-gray-700",
  bronze: "bg-orange-100 text-orange-800",
  silver: "bg-slate-200 text-slate-800",
  gold: "bg-yellow-100 text-yellow-800",
};

export default function CreatorCertification({ profile }: { profile: CertificationInput }) {
  const { level, next, requirements, progress } = evaluateCertification(profile);
  const percent = Math.round(progress * 100);

  return (
    <section aria-label="Creator certification" className="w-full max-w-md rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Certification</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${LEVEL_STYLES[level]}`}>
          {level === "none" ? "Not certified" : level}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        {next ? `Requirements for ${next} certification` : "Top certification reached"}
      </p>
      <div
        role="progressbar"
        aria-label="Certification progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div className="h-full bg-indigo-600" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {requirements.map((r) => (
          <li key={r.id} className={r.met ? "text-green-700" : "text-gray-700"}>
            <span aria-hidden="true">{r.met ? "✓" : "○"}</span> {r.label}
            <span className="sr-only">{r.met ? " (met)" : " (not met)"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

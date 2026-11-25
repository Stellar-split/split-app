import type { CoSigner } from "@/hooks/useSplitCalculator";

interface CoSignerStatusProps {
  cosigners: CoSigner[];
  threshold: number;
  connectedAddress: string | null;
}

export default function CoSignerStatus({ cosigners, threshold, connectedAddress }: CoSignerStatusProps) {
  return (
    <div className="cosigner-status">
      <h3>Co-Signers ({cosigners.length}/{threshold})</h3>
      <ul className="space-y-2">
        {cosigners.map((cosigner) => (
          <li key={cosigner.address} className="text-sm">
            <span className={cosigner.address === connectedAddress ? "font-bold" : ""}>
              {cosigner.address}
            </span>
            {cosigner.approved && <span className="ml-2">✓</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

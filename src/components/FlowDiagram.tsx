"use client";

import type { Invoice, Payment } from "@stellar-split/sdk";

type FlowDiagramProps = {
  invoice: Invoice;
};

function formatAmount(a: bigint) {
  try {
    return `${(Number(a) / 1_000_000).toFixed(6)}`;
  } catch {
    return String(a);
  }
}

function aggregateAmounts<T extends { address: string; amount: bigint }>(items: T[]) {
  const totals = new Map<string, bigint>();

  items.forEach(({ address, amount }) => {
    totals.set(address, (totals.get(address) ?? 0n) + amount);
  });

  return Array.from(totals.entries()).map(([address, amount]) => ({ address, amount }));
}

export default function FlowDiagram({ invoice }: FlowDiagramProps) {
  const payers = aggregateAmounts(
    invoice.payments.map((payment: Payment) => ({
      address: payment.payer,
      amount: payment.amount,
    }))
  );

  const recipients = aggregateAmounts(
    invoice.recipients.map((recipient) => ({
      address: recipient.address,
      amount: recipient.amount,
    }))
  );

  const payerNodes = payers.length > 0 ? payers : [{ address: "Awaiting payer", amount: 0n }];
  const recipientNodes = recipients.length > 0 ? recipients : [{ address: "No recipients", amount: 0n }];

  const width = 860;
  const height = Math.max(240, Math.max(payerNodes.length, recipientNodes.length) * 80 + 40);
  const leftX = 120;
  const centerX = width / 2;
  const rightX = width - 120;
  const maxNodes = Math.max(payerNodes.length, recipientNodes.length);
  const spacing = height / (maxNodes + 1);
  const isPending = invoice.status === "Pending";

  return (
    <section className="w-full overflow-x-auto" aria-label="Invoice payment flow diagram">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="flow-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#60a5fa" />
          </marker>
          <style>{`
            .node { fill: #0f172a; stroke: #94a3b8; stroke-width: 1.5; }
            .label { fill: #e2e8f0; font-size: 11px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
            .secondary { fill: #94a3b8; }
            .arrow { stroke: #60a5fa; stroke-width: 2; fill: none; marker-end: url(#flow-arrow); opacity: 0.75; }
            .pulse { animation: pulse 1.5s ease-in-out infinite; }
            @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
          `}</style>
        </defs>

        {payerNodes.map((payer, index) => {
          const y = spacing * (index + 1);
          const amountLabel = payer.amount > 0n ? `${formatAmount(payer.amount)} USDC` : "Awaiting payment";

          return (
            <g key={`payer-${payer.address}-${index}`}>
              <rect x={leftX - 70} y={y - 20} width={140} height={40} rx={12} className="node" />
              <text x={leftX} y={y - 2} textAnchor="middle" className="label" fontWeight="700">
                {payer.address}
              </text>
              <text x={leftX} y={y + 12} textAnchor="middle" className="secondary label">
                {amountLabel}
              </text>
              <path
                d={`M ${leftX + 70} ${y} H ${centerX - 60}`}
                className={`arrow ${isPending ? "pulse" : ""}`}
              />
              {payer.amount > 0n && (
                <text
                  x={(leftX + centerX - 60) / 2}
                  y={y - 8}
                  textAnchor="middle"
                  className="secondary label"
                >
                  {`${formatAmount(payer.amount)} USDC`}
                </text>
              )}
            </g>
          );
        })}

        <g>
          <rect x={centerX - 70} y={height / 2 - 28} width={140} height={56} rx={14} className="node" />
          <text x={centerX} y={height / 2 - 4} textAnchor="middle" className="label" fontWeight="700">
            Contract
          </text>
          <text x={centerX} y={height / 2 + 12} textAnchor="middle" className="secondary label">
            {invoice.status}
          </text>
        </g>

        {recipientNodes.map((recipient, index) => {
          const y = spacing * (index + 1);

          return (
            <g key={`recipient-${recipient.address}-${index}`}>
              <rect x={rightX - 70} y={y - 20} width={140} height={40} rx={12} className="node" />
              <text x={rightX} y={y - 2} textAnchor="middle" className="label" fontWeight="700">
                {recipient.address}
              </text>
              <text x={rightX} y={y + 12} textAnchor="middle" className="secondary label">
                {formatAmount(recipient.amount)} USDC
              </text>
              <path
                d={`M ${centerX + 60} ${y} H ${rightX - 70}`}
                className={`arrow ${isPending ? "pulse" : ""}`}
              />
              <text
                x={(centerX + rightX - 70) / 2}
                y={y - 8}
                textAnchor="middle"
                className="secondary label"
              >
                {`${formatAmount(recipient.amount)} USDC`}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

"use client"

import React from "react";
import type { Payment, Invoice } from "@stellar-split/sdk";

type FlowDiagramProps = {
  invoice: Invoice;
};

function formatAmount(a: bigint) {
  try {
    // rough conversion for display: assume amounts in stroops/atomic units
    // If SDK provides formatting, callers can change later.
    return `${(Number(a) / 1_000000).toFixed(6)}`;
  } catch {
    return String(a);
  }
}

export default function FlowDiagram({ invoice }: FlowDiagramProps) {
  const payers = invoice.payments.map((p: Payment) => ({ address: p.payer, amount: p.amount }));
  const recipients = invoice.recipients.map((r) => ({ address: r.address, amount: r.amount }));

  const width = 800;
  const height = 240;

  // layout: left column payers (stack), center contract, right column recipients (stack)
  const centerX = width / 2;
  const leftX = 120;
  const rightX = width - 120;

  const maxNodes = Math.max(payers.length || 1, recipients.length || 1, 1);
  const spacing = height / (maxNodes + 1);

  const isActive = invoice.status === "Pending";

  return (
    <div className="w-full overflow-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="240" preserveAspectRatio="xMidYMid meet" className="mx-auto">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
          <style>{`
            .node { fill: #0f172a; stroke: #94a3b8; stroke-width: 1; }
            .label { fill: #e6eef8; font-size: 12px; }
            .arrow { stroke: #94a3b8; stroke-width: 2; fill: none; marker-end: url(#arrow); }
            .pulse { animation: pulse 1.5s infinite; }
            @keyframes pulse { 0% { opacity: 0.2 } 50% { opacity: 1 } 100% { opacity: 0.2 } }
          `}</style>
        </defs>

        {/* payers */}
        {payers.map((p, i) => {
          const y = spacing * (i + 1);
          return (
            <g key={`payer-${i}`}>
              <rect x={leftX - 60} y={y - 16} width={120} height={32} rx={8} className="node" />
              <text x={leftX} y={y + 4} textAnchor="middle" className="label">{p.address}</text>
              {/* arrow to contract */}
              <line x1={leftX + 60} y1={y} x2={centerX - 40} y2={y} className={`arrow ${isActive ? "pulse" : ""}`} />
              <text x={(leftX + centerX) / 2} y={y - 6} textAnchor="middle" className="label">{formatAmount(p.amount)} USDC</text>
            </g>
          );
        })}

        {/* contract node */}
        <g>
          <rect x={centerX - 60} y={height / 2 - 20} width={120} height={40} rx={10} className="node" />
          <text x={centerX} y={height / 2 + 6} textAnchor="middle" className="label">Contract</text>
        </g>

        {/* recipients */}
        {recipients.map((r, i) => {
          const y = spacing * (i + 1);
          return (
            <g key={`recip-${i}`}>
              <rect x={rightX - 60} y={y - 16} width={120} height={32} rx={8} className="node" />
              <text x={rightX} y={y + 4} textAnchor="middle" className="label">{r.address}</text>
              {/* arrow from contract */}
              <line x1={centerX + 40} y1={y} x2={rightX - 60} y2={y} className={`arrow ${isActive ? "pulse" : ""}`} />
              <text x={(centerX + rightX) / 2} y={y - 6} textAnchor="middle" className="label">{formatAmount(r.amount)} USDC</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

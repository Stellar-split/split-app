"use client";

import React, { useRef } from "react";
import { formatAmount } from "@stellar-split/sdk";
import InvoiceQR from "@/components/InvoiceQR";

interface Invoice {
  id: string;
  title: string;
  amount: bigint;
  description?: string;
}

interface QRPrintSheetProps {
  invoices: Invoice[];
  gridLayout: "2x2" | "3x3" | "2x6";
  showLabels: boolean;
  printSheetRef: React.Ref<HTMLDivElement>;
}

type GridConfig = {
  rows: number;
  cols: number;
  gap: string;
  qrSize: string;
};

const gridConfigs: Record<"2x2" | "3x3" | "2x6", GridConfig> = {
  "2x2": { rows: 2, cols: 2, gap: "1.5rem", qrSize: "140px" },
  "3x3": { rows: 3, cols: 3, gap: "1rem", qrSize: "100px" },
  "2x6": { rows: 6, cols: 2, gap: "0.75rem", qrSize: "120px" },
};

export const QRPrintSheet = React.forwardRef<HTMLDivElement, QRPrintSheetProps>(
  ({ invoices, gridLayout, showLabels }, ref) => {
    const config = gridConfigs[gridLayout];

    return (
      <div
        ref={ref}
        className="bg-white p-8"
        style={{
          width: "210mm",
          height: "297mm",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Print-only grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
            gap: config.gap,
            width: "100%",
            maxWidth: "100%",
          }}
        >
          {invoices.slice(0, 12).map((invoice) => (
            <div
              key={invoice.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  width: config.qrSize,
                  height: config.qrSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <InvoiceQR invoiceId={invoice.id} size={parseInt(config.qrSize)} />
              </div>

              {showLabels && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    textAlign: "center",
                    fontSize: "12px",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {invoice.title}
                  </div>
                  <div style={{ color: "#666" }}>
                    {formatAmount(invoice.amount)} USDC
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

QRPrintSheet.displayName = "QRPrintSheet";

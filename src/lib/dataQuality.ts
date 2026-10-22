/**
 * Data Quality Profiler & Checker
 * - Computes profiling stats (nulls, min/max, unique, type mismatches)
 * - Runs quality checks (missing values, duplicates, outliers)
 * - Returns issues and remediation suggestions
 */

import type { Invoice, Payment } from "@stellar-split/sdk";

export interface DataQualityIssue {
  type: "missing" | "duplicate" | "outlier" | "type_mismatch";
  field: string;
  count: number;
  suggestion: string;
}

export interface DataProfile {
  field: string;
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  type: string;
}

export interface DataQualityReport {
  profile: DataProfile[];
  issues: DataQualityIssue[];
}

export function profileInvoices(invoices: Invoice[]): DataProfile[] {
  // Example: profile funded, deadline, status fields
  const fields = ["funded", "deadline", "status"];
  return fields.map((field) => {
    const values = invoices.map((inv) => (inv as any)[field]);
    const nullCount = values.filter((v) => v == null).length;
    const uniqueCount = new Set(values).size;
    let min, max, mean;
    if (typeof values[0] === "number" || typeof values[0] === "bigint") {
      const nums = values.map(Number).filter((v) => !isNaN(v));
      min = Math.min(...nums);
      max = Math.max(...nums);
      mean = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
    }
    return {
      field,
      nullCount,
      uniqueCount,
      min,
      max,
      mean,
      type: typeof values[0],
    };
  });
}

export function checkInvoiceQuality(invoices: Invoice[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  // Missing funded
  const missingFunded = invoices.filter((inv) => inv.funded == null).length;
  if (missingFunded > 0) {
    issues.push({
      type: "missing",
      field: "funded",
      count: missingFunded,
      suggestion: "Impute or fill missing funded amounts.",
    });
  }
  // Duplicate invoice IDs
  const ids = invoices.map((inv) => inv.id);
  const idCounts = ids.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {} as Record<string, number>);
  const dupIds = Object.entries(idCounts).filter(([_, c]) => c > 1);
  if (dupIds.length > 0) {
    issues.push({
      type: "duplicate",
      field: "id",
      count: dupIds.length,
      suggestion: "Remove or merge duplicate invoices.",
    });
  }
  // Outlier funded amounts (z-score > 3)
  const funded = invoices.map((inv) => Number(inv.funded)).filter((v) => !isNaN(v));
  const mean = funded.reduce((a, b) => a + b, 0) / (funded.length || 1);
  const std = Math.sqrt(funded.reduce((a, b) => a + (b - mean) ** 2, 0) / (funded.length || 1));
  const outliers = funded.filter((v) => Math.abs((v - mean) / (std || 1)) > 3).length;
  if (outliers > 0) {
    issues.push({
      type: "outlier",
      field: "funded",
      count: outliers,
      suggestion: "Review or cap extreme funded values.",
    });
  }
  return issues;
}

export function generateInvoiceQualityReport(invoices: Invoice[]): DataQualityReport {
  return {
    profile: profileInvoices(invoices),
    issues: checkInvoiceQuality(invoices),
  };
}

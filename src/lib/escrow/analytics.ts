/**
 * Escrow Analytics & Reporting System
 *
 * Aggregates escrow metrics, TVL, condition pass rates, dispute resolution statistics,
 * token volume, and generates audit reports.
 */

import type {
  EscrowAnalyticsFilter,
  EscrowAnalyticsReport,
  EscrowConditionType,
  EscrowContract,
  EscrowStatus,
} from "@/types/escrow";

const ALL_STATUSES: EscrowStatus[] = [
  "Created",
  "Funded",
  "Evaluating",
  "ReadyForRelease",
  "Released",
  "Disputed",
  "Refunded",
  "Cancelled",
];

const ALL_CONDITION_TYPES: EscrowConditionType[] = [
  "TIME_LOCK",
  "MILESTONE",
  "APPROVAL",
  "ORACLE",
  "THRESHOLD",
  "CUSTOM",
];

/**
 * Filters an array of escrows by date, token, party, or status.
 */
export function filterEscrows(
  escrows: EscrowContract[],
  filter?: EscrowAnalyticsFilter
): EscrowContract[] {
  if (!filter) return escrows;

  return escrows.filter((e) => {
    if (filter.startDate && e.createdAt < filter.startDate) return false;
    if (filter.endDate && e.createdAt > filter.endDate) return false;
    if (filter.token && e.token.toLowerCase() !== filter.token.toLowerCase()) return false;
    if (filter.depositor && e.depositor.toLowerCase() !== filter.depositor.toLowerCase()) return false;
    if (filter.beneficiary && e.beneficiary.toLowerCase() !== filter.beneficiary.toLowerCase()) return false;
    if (filter.status && e.status !== filter.status) return false;
    return true;
  });
}

/**
 * Computes comprehensive analytics report from an array of escrows.
 */
export function computeEscrowAnalytics(
  allEscrows: EscrowContract[],
  filter?: EscrowAnalyticsFilter,
  now: number = Math.floor(Date.now() / 1000)
): EscrowAnalyticsReport {
  const escrows = filterEscrows(allEscrows, filter);

  // Status counters
  const byStatus: Record<EscrowStatus, number> = {
    Created: 0,
    Funded: 0,
    Evaluating: 0,
    ReadyForRelease: 0,
    Released: 0,
    Disputed: 0,
    Refunded: 0,
    Cancelled: 0,
  };

  ALL_STATUSES.forEach((s) => {
    byStatus[s] = 0;
  });

  // Condition type counters
  const byConditionType: Record<
    EscrowConditionType,
    { total: number; met: number; passRatePercentage: number }
  > = {
    TIME_LOCK: { total: 0, met: 0, passRatePercentage: 0 },
    MILESTONE: { total: 0, met: 0, passRatePercentage: 0 },
    APPROVAL: { total: 0, met: 0, passRatePercentage: 0 },
    ORACLE: { total: 0, met: 0, passRatePercentage: 0 },
    THRESHOLD: { total: 0, met: 0, passRatePercentage: 0 },
    CUSTOM: { total: 0, met: 0, passRatePercentage: 0 },
  };

  ALL_CONDITION_TYPES.forEach((t) => {
    byConditionType[t] = { total: 0, met: 0, passRatePercentage: 0 };
  });

  // Token counters
  const byToken: Record<string, { totalVolume: bigint; activeTvl: bigint; count: number }> = {};

  let totalValueLocked = 0n;
  let totalValueReleased = 0n;
  let totalValueRefunded = 0n;
  let totalValueDisputed = 0n;

  let totalCompletedDurationSeconds = 0;
  let completedCount = 0;

  let totalResolutionSeconds = 0;
  let resolvedDisputeCount = 0;
  let totalDisputeCount = 0;
  let everFundedCount = 0;

  escrows.forEach((escrow) => {
    byStatus[escrow.status] = (byStatus[escrow.status] || 0) + 1;

    // Token tracking
    const tokenKey = escrow.token || "XLM";
    if (!byToken[tokenKey]) {
      byToken[tokenKey] = { totalVolume: 0n, activeTvl: 0n, count: 0 };
    }
    byToken[tokenKey].totalVolume += escrow.fundedAmount;
    byToken[tokenKey].count += 1;

    // Active TVL check: states with funds locked
    const isActive = ["Funded", "Evaluating", "ReadyForRelease", "Disputed"].includes(
      escrow.status
    );
    if (isActive) {
      totalValueLocked += escrow.fundedAmount;
      byToken[tokenKey].activeTvl += escrow.fundedAmount;
    }

    if (escrow.status === "Released") {
      totalValueReleased += escrow.fundedAmount;
    } else if (escrow.status === "Refunded") {
      totalValueRefunded += escrow.fundedAmount;
    }

    if (escrow.status === "Disputed" || escrow.disputeHold) {
      totalValueDisputed += escrow.fundedAmount;
    }

    // Ever funded check
    if (escrow.fundedAmount > 0n || escrow.status !== "Created") {
      everFundedCount++;
    }

    // Completed duration check
    if (escrow.status === "Released" && escrow.releasedAt) {
      totalCompletedDurationSeconds += Math.max(0, escrow.releasedAt - escrow.createdAt);
      completedCount++;
    } else if (escrow.status === "Refunded" && escrow.refundedAt) {
      totalCompletedDurationSeconds += Math.max(0, escrow.refundedAt - escrow.createdAt);
      completedCount++;
    }

    // Dispute metrics
    if (escrow.dispute) {
      totalDisputeCount++;
      if (escrow.dispute.resolvedAt && escrow.dispute.createdAt) {
        totalResolutionSeconds += Math.max(
          0,
          escrow.dispute.resolvedAt - escrow.dispute.createdAt
        );
        resolvedDisputeCount++;
      }
    }

    // Condition evaluations
    escrow.conditions?.forEach((cond) => {
      if (byConditionType[cond.type]) {
        byConditionType[cond.type].total += 1;
        if (cond.met) {
          byConditionType[cond.type].met += 1;
        }
      }
    });
  });

  // Calculate percentages
  ALL_CONDITION_TYPES.forEach((t) => {
    const stat = byConditionType[t];
    stat.passRatePercentage =
      stat.total > 0 ? Math.round((stat.met / stat.total) * 10000) / 100 : 0;
  });

  const activeEscrows =
    byStatus.Funded + byStatus.Evaluating + byStatus.ReadyForRelease + byStatus.Disputed;
  const completedEscrows = byStatus.Released + byStatus.Refunded;

  const disputeRatePercentage =
    everFundedCount > 0
      ? Math.round((totalDisputeCount / everFundedCount) * 10000) / 100
      : 0;

  const disputeResolutionRatePercentage =
    totalDisputeCount > 0
      ? Math.round((resolvedDisputeCount / totalDisputeCount) * 10000) / 100
      : 0;

  const averageDurationSeconds =
    completedCount > 0 ? Math.round(totalCompletedDurationSeconds / completedCount) : 0;

  const averageResolutionSeconds =
    resolvedDisputeCount > 0
      ? Math.round(totalResolutionSeconds / resolvedDisputeCount)
      : 0;

  return {
    summary: {
      totalEscrows: escrows.length,
      activeEscrows,
      completedEscrows,
      releasedEscrows: byStatus.Released,
      refundedEscrows: byStatus.Refunded,
      disputedEscrows: byStatus.Disputed,
      cancelledEscrows: byStatus.Cancelled,
      totalValueLocked,
      totalValueReleased,
      totalValueRefunded,
      totalValueDisputed,
      disputeRatePercentage,
      disputeResolutionRatePercentage,
      averageDurationSeconds,
      averageResolutionSeconds,
    },
    byStatus,
    byConditionType,
    byToken,
    generatedAt: now,
  };
}

/**
 * Generates an executive Markdown report from the escrow analytics.
 */
export function generateEscrowMarkdownReport(report: EscrowAnalyticsReport): string {
  const { summary, byStatus, byConditionType, byToken, generatedAt } = report;

  const dateStr = new Date(generatedAt * 1000).toISOString();

  let md = `# Escrow Analytics & Performance Report\n`;
  md += `*Generated at: ${dateStr}*\n\n`;

  md += `## Executive Summary\n`;
  md += `- **Total Escrows Tracked**: ${summary.totalEscrows}\n`;
  md += `- **Active Escrows**: ${summary.activeEscrows}\n`;
  md += `- **Completed Escrows**: ${summary.completedEscrows} (${summary.releasedEscrows} Released, ${summary.refundedEscrows} Refunded)\n`;
  md += `- **Currently Disputed**: ${summary.disputedEscrows}\n`;
  md += `- **Total Value Locked (TVL)**: ${summary.totalValueLocked.toString()} stroops\n`;
  md += `- **Total Value Released**: ${summary.totalValueReleased.toString()} stroops\n`;
  md += `- **Total Value Refunded**: ${summary.totalValueRefunded.toString()} stroops\n`;
  md += `- **Dispute Rate**: ${summary.disputeRatePercentage}%\n`;
  md += `- **Dispute Resolution Rate**: ${summary.disputeResolutionRatePercentage}%\n`;
  md += `- **Average Completion Time**: ${Math.round(summary.averageDurationSeconds / 60)} minutes\n`;
  md += `- **Average Dispute Resolution Time**: ${Math.round(summary.averageResolutionSeconds / 60)} minutes\n\n`;

  md += `## Status Breakdown\n`;
  md += `| Status | Count |\n`;
  md += `| :--- | :--- |\n`;
  Object.entries(byStatus).forEach(([status, count]) => {
    md += `| ${status} | ${count} |\n`;
  });
  md += `\n`;

  md += `## Condition Evaluation Pass Rates\n`;
  md += `| Condition Type | Total Evaluated | Met | Pass Rate |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  const conditionEntries = Object.entries(byConditionType) as [
    EscrowConditionType,
    { total: number; met: number; passRatePercentage: number }
  ][];
  conditionEntries.forEach(([type, stat]) => {
    md += `| ${type} | ${stat.total} | ${stat.met} | ${stat.passRatePercentage}% |\n`;
  });
  md += `\n`;

  md += `## Volume by Token\n`;
  md += `| Token | Count | Total Volume | Active TVL |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  const tokenEntries = Object.entries(byToken) as [
    string,
    { totalVolume: bigint; activeTvl: bigint; count: number }
  ][];
  tokenEntries.forEach(([token, data]) => {
    md += `| ${token} | ${data.count} | ${data.totalVolume.toString()} | ${data.activeTvl.toString()} |\n`;
  });

  return md;
}

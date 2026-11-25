/**
 * Blockchain settlement analytics derived from settlement records and the
 * on-chain verification audit trail.
 */
import type { BlockchainAnalytics, SettlementAuditEntry, SettlementRecord } from './types';

export function computeBlockchainAnalytics(
  settlements: SettlementRecord[],
  auditEntries: SettlementAuditEntry[] = []
): BlockchainAnalytics {
  const totalSettlements = settlements.length;
  const verifiedSettlements = settlements.filter((s) => s.status === 'verified').length;
  const failedSettlements = settlements.filter((s) => s.status === 'failed').length;

  const onChainVerified = auditEntries.filter((e) => e.action === 'on_chain_verified').length;
  const onChainMismatched = auditEntries.filter((e) => e.action === 'on_chain_mismatch').length;
  const onChainErrors = auditEntries.filter((e) => e.action === 'on_chain_error').length;

  const totalVolumeByAsset: Record<string, number> = {};
  let latencySum = 0;
  let feeSum = 0;
  let lastSettlementAt: number | undefined;

  for (const settlement of settlements) {
    totalVolumeByAsset[settlement.destinationAsset] =
      (totalVolumeByAsset[settlement.destinationAsset] ?? 0) + settlement.netDestinationAmount;
    latencySum += settlement.executionLatencyMs;
    feeSum += settlement.totalFee;
    if (lastSettlementAt === undefined || settlement.settledAt > lastSettlementAt) {
      lastSettlementAt = settlement.settledAt;
    }
  }

  return {
    totalSettlements,
    verifiedSettlements,
    failedSettlements,
    onChainVerified,
    onChainMismatched,
    onChainErrors,
    verificationRate: totalSettlements === 0 ? 0 : verifiedSettlements / totalSettlements,
    totalVolumeByAsset,
    averageLatencyMs: totalSettlements === 0 ? 0 : latencySum / totalSettlements,
    averageSettlementFee: totalSettlements === 0 ? 0 : feeSum / totalSettlements,
    lastSettlementAt,
  };
}

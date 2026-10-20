import { AssetSymbol, FeeSummary, SettlementFeeRecord } from './types';

export class SettlementFeeTracker {
  private records: Map<string, SettlementFeeRecord> = new Map();

  /**
   * Track fees for an executed settlement
   */
  public recordFee(feeRecord: Omit<SettlementFeeRecord, 'feeId'> & { feeId?: string }): SettlementFeeRecord {
    const feeId = feeRecord.feeId || `fee_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const fullRecord: SettlementFeeRecord = {
      ...feeRecord,
      feeId,
      totalFee: feeRecord.lpFee + feeRecord.platformSettlementFee + feeRecord.networkFee,
    };

    this.records.set(feeId, fullRecord);
    return fullRecord;
  }

  public getFeeRecord(feeId: string): SettlementFeeRecord | undefined {
    return this.records.get(feeId);
  }

  public getFeesByInvoice(invoiceId: string): SettlementFeeRecord[] {
    return Array.from(this.records.values()).filter((r) => r.invoiceId === invoiceId);
  }

  public getFeesBySettlement(settlementId: string): SettlementFeeRecord | undefined {
    return Array.from(this.records.values()).find((r) => r.settlementId === settlementId);
  }

  public getFeesByProvider(providerId: string): SettlementFeeRecord[] {
    return Array.from(this.records.values()).filter((r) => r.providerId === providerId);
  }

  public getAllRecords(): SettlementFeeRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Generate aggregated summary of fees, optionally filtered by asset and timestamp
   */
  public getSummary(asset?: AssetSymbol, sinceTimestamp?: number): FeeSummary {
    const records = Array.from(this.records.values()).filter((r) => {
      if (asset && r.asset !== asset) return false;
      if (sinceTimestamp && r.timestamp < sinceTimestamp) return false;
      return true;
    });

    const summary: FeeSummary = {
      asset: asset ?? 'ALL',
      totalLpFees: 0,
      totalPlatformFees: 0,
      totalNetworkFees: 0,
      totalFees: 0,
      settlementCount: records.length,
      averageFeePerSettlement: 0,
    };

    for (const record of records) {
      summary.totalLpFees += record.lpFee;
      summary.totalPlatformFees += record.platformSettlementFee;
      summary.totalNetworkFees += record.networkFee;
      summary.totalFees += record.totalFee;
    }

    if (records.length > 0) {
      summary.averageFeePerSettlement = summary.totalFees / records.length;
    }

    return summary;
  }

  public clear(): void {
    this.records.clear();
  }
}

export const defaultSettlementFeeTracker = new SettlementFeeTracker();

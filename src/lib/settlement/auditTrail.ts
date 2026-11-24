/**
 * Append-only audit trail for blockchain settlement activity.
 */
import type { SettlementAuditEntry } from './types';

export class SettlementAuditTrail {
  private entries: SettlementAuditEntry[] = [];
  private sequence = 0;

  public record(
    entry: Omit<SettlementAuditEntry, 'id' | 'timestamp'> & { timestamp?: number }
  ): SettlementAuditEntry {
    const full: SettlementAuditEntry = {
      ...entry,
      id: `sat_${Date.now()}_${++this.sequence}`,
      timestamp: entry.timestamp ?? Date.now(),
    };
    this.entries.push(full);
    return full;
  }

  public getEntries(settlementId?: string): SettlementAuditEntry[] {
    const list = settlementId
      ? this.entries.filter((e) => e.settlementId === settlementId)
      : [...this.entries];
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }

  public clear(): void {
    this.entries = [];
    this.sequence = 0;
  }
}

export const defaultSettlementAuditTrail = new SettlementAuditTrail();

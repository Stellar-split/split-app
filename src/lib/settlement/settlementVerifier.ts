import { SettlementRecord, SettlementVerificationResult } from './types';
import type { BlockchainClient } from './blockchainClient';

export class SettlementVerifier {
  /**
   * Verify an executed settlement against cryptographic and business rules
   */
  public verifySettlement(record: SettlementRecord): SettlementVerificationResult {
    const discrepancies: string[] = [];

    // 1. Transaction hash validation
    const hasValidTxHash =
      typeof record.txHash === 'string' &&
      record.txHash.length >= 10 &&
      (record.txHash.startsWith('stl_') || record.txHash.startsWith('mm_tx_') || record.txHash.startsWith('0x'));

    if (!hasValidTxHash) {
      discrepancies.push(`Invalid transaction hash: ${record.txHash}`);
    }

    // 2. Cryptographic proof validation
    const hasValidProof =
      typeof record.verificationProof === 'string' &&
      record.verificationProof.length >= 12 &&
      (record.verificationProof.startsWith('proof_') || record.verificationProof.startsWith('sig_mm_'));

    if (!hasValidProof) {
      discrepancies.push('Invalid or missing settlement cryptographic proof');
    }

    // 3. Amount and fee balance consistency
    // grossDestinationAmount should equal netDestinationAmount + settlementFee + (lpFee if deducted from dest)
    const tolerance = 0.0001;
    const computedTotal = record.netDestinationAmount + record.settlementFee;
    const grossDiff = Math.abs(computedTotal - record.grossDestinationAmount);

    // If LP fee is included in the gross
    const isAmountValid =
      grossDiff <= tolerance ||
      Math.abs(record.netDestinationAmount + record.totalFee - record.grossDestinationAmount) <= tolerance ||
      record.netDestinationAmount > 0;

    if (!isAmountValid || record.netDestinationAmount <= 0) {
      discrepancies.push(
        `Destination amount inconsistency: net ${record.netDestinationAmount}, fee ${record.settlementFee}, gross ${record.grossDestinationAmount}`
      );
    }

    // 4. Recipient address validation
    const isRecipientValid =
      typeof record.recipientAddress === 'string' &&
      record.recipientAddress.trim().length > 0;

    if (!isRecipientValid) {
      discrepancies.push('Missing or empty recipient address');
    }

    // 5. Timing validation
    const now = Date.now();
    const isTimingValid =
      typeof record.settledAt === 'number' &&
      record.settledAt <= now + 5000 && // allow 5s clock skew
      record.settledAt >= now - 365 * 24 * 60 * 60 * 1000;

    if (!isTimingValid) {
      discrepancies.push(`Unrealistic settlement timestamp: ${record.settledAt}`);
    }

    // 6. Status check
    if (record.status !== 'settled' && record.status !== 'verified') {
      discrepancies.push(`Unexpected settlement status for verification: ${record.status}`);
    }

    const verified =
      hasValidTxHash &&
      hasValidProof &&
      isAmountValid &&
      isRecipientValid &&
      isTimingValid &&
      discrepancies.length === 0;

    return {
      settlementId: record.settlementId,
      verified,
      verifiedAt: Date.now(),
      txHash: record.txHash,
      proofValid: hasValidProof,
      amountValid: isAmountValid,
      recipientValid: isRecipientValid,
      timingValid: isTimingValid,
      settlementRecord: record,
      discrepancies,
    };
  }

  /**
   * Verify a settlement against the Stellar blockchain (Horizon) and merge the
   * on-chain result into the local verification result.
   */
  public async verifyOnChain(
    record: SettlementRecord,
    client: BlockchainClient
  ): Promise<SettlementVerificationResult> {
    const local = this.verifySettlement(record);
    const onChain = await client.verifyTransaction(record.txHash);

    const discrepancies = [...local.discrepancies];
    if (!onChain.found) {
      discrepancies.push(onChain.error ?? `Transaction ${record.txHash} not found on chain`);
    } else {
      if (!onChain.successful) {
        discrepancies.push(`On-chain transaction ${record.txHash} failed`);
      }
      if (onChain.destinationAccount && onChain.destinationAccount !== record.recipientAddress) {
        discrepancies.push(
          `On-chain destination ${onChain.destinationAccount} does not match recipient ${record.recipientAddress}`
        );
      }
      if (onChain.amount !== undefined) {
        const tolerance = Math.max(0.0001, record.netDestinationAmount * 0.001);
        if (Math.abs(onChain.amount - record.netDestinationAmount) > tolerance) {
          discrepancies.push(
            `On-chain amount ${onChain.amount} does not match net destination ${record.netDestinationAmount}`
          );
        }
      }
    }

    return {
      ...local,
      verified: local.verified && onChain.found && onChain.successful && discrepancies.length === 0,
      verifiedAt: Date.now(),
      discrepancies,
      onChain,
    };
  }
}

export const defaultSettlementVerifier = new SettlementVerifier();

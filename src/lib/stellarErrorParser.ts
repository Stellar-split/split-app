export type ErrorActionType = 'bump-fee' | 'refresh-seq' | 'fund-destination' | 'manual';

export interface ParsedStellarError {
  code: string;
  title: string;
  explanation: string;
  suggestedAction: string;
  actionType: ErrorActionType;
  message?: string;
}

export interface StellarErrorMessage {
  code: string;
  message: string;
}

/**
 * Known Stellar operation result codes mapped to human-readable explanations.
 */
export const STELLAR_OPERATION_ERRORS: Record<string, string> = {
  op_no_trust: "The recipient does not have a trustline for this asset.",
  op_underfunded: "The source account does not have enough balance to complete the payment.",
  op_no_destination: "The destination account does not exist on the network and must be funded first.",
  op_not_authorized: "The account is not authorized to hold or transfer this asset.",
  op_line_full: "The destination account would exceed its trustline limit with this payment.",
  op_no_issuer: "The issuer of the asset does not exist on the network.",
  op_low_reserve: "The account balance is insufficient to satisfy minimum reserve requirements.",
  op_bad_auth: "The transaction has invalid or insufficient signatures.",
  op_src_no_trust: "The source account does not have a trustline for the specified asset.",
  op_src_not_authorized: "The source account is not authorized to transfer this asset.",
  op_cross_self: "The offer would cross an existing offer from the same account.",
  op_sell_no_trust: "The account selling the asset does not have a valid trustline.",
  op_buy_no_trust: "The account buying the asset does not have a valid trustline.",
  op_sell_not_authorized: "The account is not authorized to sell this asset.",
  op_buy_not_authorized: "The account is not authorized to buy this asset.",
  op_too_few_offers: "There are no suitable offers on the orderbook to satisfy this trade.",
  op_offer_not_found: "The specified offer does not exist on the network.",
  op_bad_limit: "The requested trustline limit is invalid.",
  op_already_exists: "The claimable balance or account already exists.",
  op_does_not_exist: "The specified claimable balance or entry does not exist.",
  op_cant_revoke: "The sponsor or revocable asset settings prevent revoking this entry.",
  op_not_supported: "The operation is not supported by the network or account.",
};

/**
 * Converts a raw Stellar operation result code to a user-friendly message.
 * Falls back to "Transaction failed: {raw code}" for unknown codes.
 */
export function parseStellarOperationError(code: string): StellarErrorMessage {
  const rawCode = (code || '').trim();
  const normalized = rawCode.toLowerCase();

  if (STELLAR_OPERATION_ERRORS[normalized]) {
    return {
      code: rawCode,
      message: STELLAR_OPERATION_ERRORS[normalized],
    };
  }

  return {
    code: rawCode,
    message: `Transaction failed: ${rawCode || 'unknown'}`,
  };
}

export const mapStellarErrorCode = parseStellarOperationError;
export const getStellarErrorMessage = parseStellarOperationError;

const ERROR_MAPPING: Record<string, ParsedStellarError> = {
  tx_insufficient_fee: {
    code: 'tx_insufficient_fee',
    title: 'Insufficient Transaction Fee',
    explanation: 'The transaction fee is too low for current network conditions. Network fees fluctuate based on demand.',
    suggestedAction: 'Increase the transaction fee using the fee bump slider. Check the median network fee and increase yours accordingly.',
    actionType: 'bump-fee',
    message: 'The transaction fee is too low for current network conditions.',
  },
  tx_bad_seq: {
    code: 'tx_bad_seq',
    title: 'Invalid Sequence Number',
    explanation: 'The transaction sequence number is outdated or invalid. This can happen if another transaction from this account was recently submitted.',
    suggestedAction: 'Refresh the sequence number from the blockchain and rebuild the transaction.',
    actionType: 'refresh-seq',
    message: 'The transaction sequence number is outdated or invalid.',
  },
  op_no_destination: {
    code: 'op_no_destination',
    title: 'Destination Account Not Found',
    explanation: 'The recipient account does not exist on the Stellar network. New accounts must be funded first.',
    suggestedAction: 'Fund the destination account with at least 1 XLM (or use Friendbot on testnet), then retry this payment.',
    actionType: 'fund-destination',
    message: 'The destination account does not exist on the network and must be funded first.',
  },
  op_underfunded: {
    code: 'op_underfunded',
    title: 'Insufficient Balance',
    explanation: 'The source account does not have enough balance to cover the payment and transaction fees.',
    suggestedAction: 'Add more funds to your account and try again.',
    actionType: 'manual',
    message: 'The source account does not have enough balance to complete the payment.',
  },
  tx_failed: {
    code: 'tx_failed',
    title: 'Transaction Failed',
    explanation: 'An operation in the transaction failed. This could be due to various reasons including trustline issues.',
    suggestedAction: 'Check the detailed error message and verify all account requirements are met.',
    actionType: 'manual',
    message: 'An operation in the transaction failed.',
  },
  op_no_trust: {
    code: 'op_no_trust',
    title: 'Missing Trustline',
    explanation: 'The account does not have a trustline for the asset being transferred.',
    suggestedAction: 'Establish a trustline for this asset first, then retry.',
    actionType: 'manual',
    message: 'The recipient does not have a trustline for this asset.',
  },
};

export function parseStellarError(errorCode: string, rawError?: any): ParsedStellarError {
  const normalizedCode = errorCode.toLowerCase().trim();

  // Check direct mapping
  if (ERROR_MAPPING[normalizedCode]) {
    const found = ERROR_MAPPING[normalizedCode];
    return { ...found, message: found.message || found.explanation };
  }

  // Try to extract result_code from Horizon error response
  const resultCode = rawError?.response?.data?.result_code || rawError?.result_code;
  if (resultCode && ERROR_MAPPING[resultCode]) {
    const found = ERROR_MAPPING[resultCode];
    return { ...found, message: found.message || found.explanation };
  }

  // Check for partial matches (e.g., "tx_insufficient_fee" in larger error string)
  for (const [key, value] of Object.entries(ERROR_MAPPING)) {
    if (normalizedCode.includes(key) || (typeof rawError === 'string' && rawError.includes(key))) {
      return { ...value, message: value.message || value.explanation };
    }
  }

  // Fallback for unknown errors
  return {
    code: 'unknown_error',
    title: 'Transaction Error',
    explanation: `The transaction failed with error: ${errorCode}`,
    suggestedAction: 'Review the error details and contact support if the issue persists.',
    actionType: 'manual',
    message: `Transaction failed: ${errorCode}`,
  };
}

export function isBumpFeeError(error: any): boolean {
  const parsed = parseStellarError(error?.message || error?.code || String(error), error);
  return parsed.actionType === 'bump-fee';
}

export function isSequenceError(error: any): boolean {
  const parsed = parseStellarError(error?.message || error?.code || String(error), error);
  return parsed.actionType === 'refresh-seq';
}

export function isFundingError(error: any): boolean {
  const parsed = parseStellarError(error?.message || error?.code || String(error), error);
  return parsed.actionType === 'fund-destination';
}

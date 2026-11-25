/**
 * Split payment rule validation.
 *
 * Validates split payment requests against configurable rules
 * before execution to ensure all recipients receive correct amounts.
 */

import type { RecipientLine } from '@/hooks/useSplitCalculator';
import type { SplitRule, SplitRuleConfig } from '@/types/splitPayment';
import { MAX_RECIPIENTS } from '@/lib/stellar';

/** Default rule configuration */
export const DEFAULT_SPLIT_RULE_CONFIG: SplitRuleConfig = {
  minRecipientAmount: 0.0000001, // 1 stroop
  maxTotalAmount: 1_000_000_000, // 1 billion units
  maxRecipients: MAX_RECIPIENTS,
  minSharePercent: 0.0001,
  requireUniqueAddresses: true,
  requireValidAddresses: true,
};

/** Stellar public key regex (starts with G, 56 chars, base32) */
const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Validate minimum per-recipient amount.
 * Each recipient must receive at least `minRecipientAmount` after split.
 */
export function validateMinAmount(
  totalAmount: number,
  recipients: RecipientLine[],
  minRecipientAmount: number
): SplitRule {
  const failingRecipients: number[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipientAmount = (totalAmount * (recipients[i].sharePercent || 0)) / 100;
    if (recipientAmount > 0 && recipientAmount < minRecipientAmount) {
      failingRecipients.push(i + 1);
    }
  }

  const passed = failingRecipients.length === 0;
  return {
    type: 'min_amount',
    description: `Each recipient must receive at least ${minRecipientAmount} units`,
    passed,
    errorMessage: passed
      ? undefined
      : `Recipients ${failingRecipients.join(', ')} would receive less than the minimum amount of ${minRecipientAmount}`,
  };
}

/**
 * Validate maximum total amount.
 */
export function validateMaxAmount(
  totalAmount: number,
  maxTotalAmount: number
): SplitRule {
  const passed = totalAmount <= maxTotalAmount;
  return {
    type: 'max_amount',
    description: `Total amount must not exceed ${maxTotalAmount}`,
    passed,
    errorMessage: passed
      ? undefined
      : `Total amount ${totalAmount} exceeds maximum allowed ${maxTotalAmount}`,
  };
}

/**
 * Validate maximum number of recipients.
 */
export function validateMaxRecipients(
  recipients: RecipientLine[],
  maxRecipients: number
): SplitRule {
  const passed = recipients.length <= maxRecipients;
  return {
    type: 'max_recipients',
    description: `Maximum ${maxRecipients} recipients allowed`,
    passed,
    errorMessage: passed
      ? undefined
      : `${recipients.length} recipients exceeds the maximum of ${maxRecipients}`,
  };
}

/**
 * Validate minimum share percentage per recipient.
 */
export function validateMinSharePercent(
  recipients: RecipientLine[],
  minSharePercent: number
): SplitRule {
  const failingRecipients: number[] = [];

  for (let i = 0; i < recipients.length; i++) {
    if (recipients[i].sharePercent > 0 && recipients[i].sharePercent < minSharePercent) {
      failingRecipients.push(i + 1);
    }
  }

  const passed = failingRecipients.length === 0;
  return {
    type: 'min_share_percent',
    description: `Each recipient must have at least ${minSharePercent}% share`,
    passed,
    errorMessage: passed
      ? undefined
      : `Recipients ${failingRecipients.join(', ')} have share below minimum ${minSharePercent}%`,
  };
}

/**
 * Validate that all recipient addresses are unique.
 */
export function validateUniqueAddresses(recipients: RecipientLine[]): SplitRule {
  const addresses = recipients.map((r) => r.address);
  const uniqueAddresses = new Set(addresses);
  const passed = uniqueAddresses.size === addresses.length;

  let errorMessage: string | undefined;
  if (!passed) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const addr of addresses) {
      if (seen.has(addr)) {
        duplicates.add(addr);
      }
      seen.add(addr);
    }
    errorMessage = `Duplicate recipient addresses found: ${Array.from(duplicates).join(', ')}`;
  }

  return {
    type: 'unique_addresses',
    description: 'All recipient addresses must be unique',
    passed,
    errorMessage,
  };
}

/**
 * Validate that all recipient addresses are valid Stellar public keys.
 */
export function validateAddresses(recipients: RecipientLine[]): SplitRule {
  const invalidRecipients: number[] = [];

  for (let i = 0; i < recipients.length; i++) {
    if (!STELLAR_ADDRESS_REGEX.test(recipients[i].address)) {
      invalidRecipients.push(i + 1);
    }
  }

  const passed = invalidRecipients.length === 0;
  return {
    type: 'valid_addresses',
    description: 'All recipient addresses must be valid Stellar public keys',
    passed,
    errorMessage: passed
      ? undefined
      : `Recipients ${invalidRecipients.join(', ')} have invalid Stellar addresses`,
  };
}

/**
 * Validate that the payer has sufficient balance for the total amount.
 */
export function validateSufficientBalance(
  totalAmount: number,
  availableBalance: number | undefined
): SplitRule {
  if (availableBalance === undefined) {
    return {
      type: 'sufficient_balance',
      description: 'Payer must have sufficient balance',
      passed: true, // Skip if balance is unknown
    };
  }

  const passed = availableBalance >= totalAmount;
  return {
    type: 'sufficient_balance',
    description: 'Payer must have sufficient balance',
    passed,
    errorMessage: passed
      ? undefined
      : `Insufficient balance: ${availableBalance} available, ${totalAmount} required`,
  };
}

/**
 * Run all split payment rules against the provided request parameters.
 */
export function validateSplitRules(
  totalAmount: number,
  recipients: RecipientLine[],
  config: Partial<SplitRuleConfig> = {}
): { rules: SplitRule[]; allPassed: boolean } {
  const mergedConfig: SplitRuleConfig = {
    ...DEFAULT_SPLIT_RULE_CONFIG,
    ...config,
  };

  const rules: SplitRule[] = [
    validateMinAmount(totalAmount, recipients, mergedConfig.minRecipientAmount),
    validateMaxAmount(totalAmount, mergedConfig.maxTotalAmount),
    validateMaxRecipients(recipients, mergedConfig.maxRecipients),
    validateMinSharePercent(recipients, mergedConfig.minSharePercent),
  ];

  if (mergedConfig.requireUniqueAddresses) {
    rules.push(validateUniqueAddresses(recipients));
  }

  if (mergedConfig.requireValidAddresses) {
    rules.push(validateAddresses(recipients));
  }

  rules.push(
    validateSufficientBalance(totalAmount, mergedConfig.availableBalance)
  );

  const allPassed = rules.every((r) => r.passed);
  return { rules, allPassed };
}

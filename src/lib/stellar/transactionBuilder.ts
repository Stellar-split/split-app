import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
  Account,
} from '@stellar/stellar-sdk';

export interface BuildPaymentTxParams {
  sourcePublicKey: string;
  destinationPublicKey: string;
  assetCode: string;
  assetIssuer: string | null; // null = XLM
  amount: string;
  memo?: string;
  networkPassphrase?: string;
  sequenceNumber?: string;
}

export interface BuiltTransaction {
  /** base64-encoded XDR of the built transaction envelope */
  xdr: string;
  /** The network passphrase used */
  networkPassphrase: string;
}

/**
 * Builds a Stellar payment transaction XDR ready for signing.
 * Loaded dynamically to keep @stellar/stellar-sdk out of initial bundles.
 */
export async function buildPaymentTransaction({
  sourcePublicKey,
  destinationPublicKey,
  assetCode,
  assetIssuer,
  amount,
  memo,
  networkPassphrase = Networks.TESTNET,
  sequenceNumber = '0',
}: BuildPaymentTxParams): Promise<BuiltTransaction> {
  const asset =
    assetCode === 'XLM' && !assetIssuer
      ? Asset.native()
      : new Asset(assetCode, assetIssuer!);

  const sourceAccount = new Account(sourcePublicKey, sequenceNumber);

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount,
      }),
    )
    .setTimeout(300);

  if (memo) {
    builder.addMemo(Memo.text(memo));
  }

  const tx = builder.build();
  return {
    xdr: tx.toEnvelope().toXDR('base64'),
    networkPassphrase,
  };
}

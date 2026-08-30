import { NextRequest, NextResponse } from 'next/server';
import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Memo,
  Account,
  Keypair,
} from '@stellar/stellar-sdk';

const HOME_DOMAIN = process.env.SEP10_HOME_DOMAIN ?? 'stellarsplit.app';
const SERVER_SIGNING_KEY = process.env.SEP10_SERVER_SIGNING_KEY ?? '';

/**
 * GET /api/auth/challenge?account={publicKey}
 *
 * Returns a base64-encoded unsigned SEP-0010 challenge transaction
 * valid for 5 minutes. The client must sign it with Freighter and
 * POST the result to /api/auth/token.
 */
export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account');
  if (!account) {
    return NextResponse.json({ error: 'Missing account parameter' }, { status: 400 });
  }

  // Basic Stellar public key format check
  if (!/^G[A-Z2-7]{55}$/.test(account)) {
    return NextResponse.json({ error: 'Invalid account format' }, { status: 400 });
  }

  if (!SERVER_SIGNING_KEY) {
    return NextResponse.json(
      { error: 'Server signing key not configured' },
      { status: 500 }
    );
  }

  let serverKeypair: ReturnType<typeof Keypair.fromSecret>;
  try {
    serverKeypair = Keypair.fromSecret(SERVER_SIGNING_KEY);
  } catch {
    return NextResponse.json(
      { error: 'Invalid server signing key configuration' },
      { status: 500 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 300; // 5 minutes
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString('base64');

  // SEP-0010 spec: use the client account as the transaction source,
  // with a sequence number of 0 (challenge tx is never submitted on-chain).
  const sourceAccount = new Account(account, '-1');

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase:
      process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
        ? Networks.PUBLIC
        : Networks.TESTNET,
    timebounds: { minTime: now, maxTime: expiry },
  })
    .addOperation(
      Operation.manageData({
        name: `${HOME_DOMAIN} auth`,
        value: nonce,
        source: serverKeypair.publicKey(),
      })
    )
    .build();

  // The server signs its own ManageData operation source
  tx.sign(serverKeypair);

  const xdr = tx.toEnvelope().toXDR('base64');

  return NextResponse.json(
    {
      transaction: xdr,
      network_passphrase:
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
          ? Networks.PUBLIC
          : Networks.TESTNET,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

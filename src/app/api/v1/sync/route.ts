import { NextRequest } from "next/server";
import { fetchInvoicesForAddress } from "@/lib/stellar/horizonServer";
import {
  apiError,
  apiSuccess,
  isApiResponse,
  prepareApiRequest,
} from "@/lib/apiV1";
import { StellarPublicKeySchema } from "@/lib/apiV1Schemas";
import {
  applyMutations,
  pullDelta,
  type SyncMutation,
  type SyncRecord,
} from "@/lib/mobileSync";

export const dynamic = "force-dynamic";

/** Process-local applied-mutation ids, used to make sync retries idempotent. */
const appliedMutationIds = new Set<string>();

function toSyncRecords(invoices: unknown[]): SyncRecord[] {
  return invoices.map((raw) => {
    const invoice = raw as {
      id: string | number;
      deadline?: number;
      funded?: bigint;
      status?: string;
      recipients?: { address: string; amount: bigint }[];
    };
    return {
      invoiceId: String(invoice.id),
      updatedAt: (invoice.deadline ?? 0) * 1000,
      deleted: false,
      payload: {
        id: String(invoice.id),
        deadline: invoice.deadline ?? 0,
        funded: String(invoice.funded ?? 0n),
        status: invoice.status ?? "Pending",
        recipients: (invoice.recipients ?? []).map((r) => ({
          address: r.address,
          amount: String(r.amount),
        })),
      },
    };
  });
}

export async function GET(request: NextRequest) {
  const context = prepareApiRequest(request);
  if (isApiResponse(context)) return context;

  const params = request.nextUrl.searchParams;
  const publicKey = StellarPublicKeySchema.safeParse(params.get("publicKey"));
  if (!publicKey.success) {
    return apiError(400, "VALIDATION_ERROR", "A valid Stellar public key is required.", context);
  }

  try {
    const { invoices } = await fetchInvoicesForAddress(publicKey.data, { limit: 50 });
    const delta = pullDelta(toSyncRecords(invoices), params.get("cursor"));
    return apiSuccess(delta, context);
  } catch {
    return apiError(502, "UPSTREAM_ERROR", "Unable to fetch invoices from the Stellar network.", context);
  }
}

export async function POST(request: NextRequest) {
  const context = prepareApiRequest(request);
  if (isApiResponse(context)) return context;

  const body = (await request.json().catch(() => null)) as
    | { publicKey?: string; mutations?: SyncMutation[] }
    | null;
  if (!body) return apiError(400, "VALIDATION_ERROR", "Invalid JSON body.", context);

  const publicKey = StellarPublicKeySchema.safeParse(body.publicKey);
  if (!publicKey.success) {
    return apiError(400, "VALIDATION_ERROR", "A valid Stellar public key is required.", context);
  }
  if (!Array.isArray(body.mutations)) {
    return apiError(400, "VALIDATION_ERROR", "mutations must be an array.", context);
  }

  try {
    const { invoices } = await fetchInvoicesForAddress(publicKey.data, { limit: 50 });
    const { records, result } = applyMutations(
      toSyncRecords(invoices),
      body.mutations,
      appliedMutationIds,
    );
    return apiSuccess({ ...result, records }, context);
  } catch {
    return apiError(502, "UPSTREAM_ERROR", "Unable to sync mutations with the Stellar network.", context);
  }
}

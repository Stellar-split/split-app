import { NextRequest } from "next/server";
import { fetchInvoicesForAddress } from "@/lib/stellar/horizonServer";
import {
  apiError,
  apiSuccess,
  isApiResponse,
  prepareApiRequest,
} from "@/lib/apiV1";
import { InvoiceListQuerySchema } from "@/lib/apiV1Schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = prepareApiRequest(request);
  if (isApiResponse(context)) return context;

  const parsed = InvoiceListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "One or more query parameters are invalid.",
      context,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await fetchInvoicesForAddress(parsed.data.publicKey, {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      q: parsed.data.q,
    });
    return apiSuccess(result, context);
  } catch {
    return apiError(502, "UPSTREAM_ERROR", "Unable to fetch invoices from the Stellar network.", context);
  }
}
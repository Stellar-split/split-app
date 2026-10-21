import { NextRequest } from "next/server";
import { splitClient } from "@/lib/stellar";
import {
  apiError,
  apiSuccess,
  isApiResponse,
  prepareApiRequest,
} from "@/lib/apiV1";
import { InvoiceHistoryQuerySchema, InvoiceIdSchema } from "@/lib/apiV1Schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = prepareApiRequest(request);
  if (isApiResponse(context)) return context;

  const parsedId = InvoiceIdSchema.safeParse(params.id);
  const parsedQuery = InvoiceHistoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsedId.success || !parsedQuery.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invoice ID or history query parameters are invalid.",
      context,
      parsedQuery.success ? undefined : parsedQuery.error.flatten(),
    );
  }

  try {
    const invoice = await splitClient.getInvoice(parsedId.data);
    const { cursor, limit } = parsedQuery.data;
    const payments = invoice.payments.slice(cursor, cursor + limit);
    const nextCursor = cursor + payments.length < invoice.payments.length
      ? String(cursor + payments.length)
      : null;
    return apiSuccess({ payments, nextCursor }, context);
  } catch {
    return apiError(404, "NOT_FOUND", "Invoice was not found.", context);
  }
}
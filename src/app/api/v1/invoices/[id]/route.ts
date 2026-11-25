import { NextRequest } from "next/server";
import { splitClient } from "@/lib/stellar";
import {
  apiError,
  apiSuccess,
  isApiResponse,
  prepareApiRequest,
} from "@/lib/apiV1";
import { InvoiceIdSchema } from "@/lib/apiV1Schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = prepareApiRequest(request);
  if (isApiResponse(context)) return context;

  const parsedId = InvoiceIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return apiError(400, "VALIDATION_ERROR", "Invoice ID must be a positive integer.", context);
  }

  try {
    const invoice = await splitClient.getInvoice(parsedId.data);
    return apiSuccess({ invoice }, context);
  } catch {
    return apiError(404, "NOT_FOUND", "Invoice was not found.", context);
  }
}
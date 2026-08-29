import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { splitClient } from "@/lib/stellar";
import { safeParseSplitMeta, type SplitMetaInput } from "@/lib/splitMetaSchema";

import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

interface SplitMetaStore {
  [invoiceId: string]: SplitMetaInput;
}

let memoryStore: SplitMetaStore = {};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const invoiceId = params.id;
    const walletPublicKey = request.headers.get("x-wallet-public-key");

    if (!walletPublicKey) {
      return NextResponse.json({ error: "Missing wallet public key" }, { status: 403 });
    }

    const invoice = await splitClient.getInvoice(invoiceId);
    const isCreator = invoice.creator === walletPublicKey;
    const isRecipient = invoice.recipients.some((recipient) => recipient.address === walletPublicKey);

    if (!isCreator && !isRecipient) {
      return NextResponse.json({ error: "Not authorized for this invoice" }, { status: 403 });
    }

    const rawBody = await request.json();

    const { splitMeta } = rawBody as { splitMeta?: unknown };

    if (splitMeta === undefined || splitMeta === null) {
      return NextResponse.json(
        { error: "Missing splitMeta in request body" },
        { status: 400 }
      );
    }

    const parseResult = safeParseSplitMeta(splitMeta);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid splitMeta payload",
          details: parseResult.error?.issues,
        },
        { status: 422 }
      );
    }

    memoryStore[invoiceId] = parseResult.data!;

    return NextResponse.json(
      {
        success: true,
        invoiceId,
        splitMeta: parseResult.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("SplitMeta save error:", error);
    return NextResponse.json(
      {
        error: "Failed to persist splitMeta",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;
    const splitMeta = memoryStore[invoiceId];

    return NextResponse.json(
      {
        invoiceId,
        splitMeta: splitMeta ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("SplitMeta fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch splitMeta",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

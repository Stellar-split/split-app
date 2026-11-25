/**
 * POST /api/invoices/qr-batch
 * Generate QR codes for multiple invoices in batch.
 *
 * Request body:
 * {
 *   invoiceIds: string[];
 * }
 *
 * Response:
 * {
 *   qrCodes: Array<{
 *     invoiceId: string;
 *     dataUrl: string;
 *     url: string;
 *   }>;
 * }
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

interface QRCodeResult {
  invoiceId: string;
  dataUrl: string;
  url: string;
}

export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const invoiceIds: string[] = body.invoiceIds || [];

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "No invoice IDs provided" },
        { status: 400 }
      );
    }

    if (invoiceIds.length > 12) {
      return NextResponse.json(
        { error: "Maximum 12 invoices per batch" },
        { status: 400 }
      );
    }

    const qrCodes: QRCodeResult[] = [];

    // Generate QR codes for each invoice
    for (const invoiceId of invoiceIds) {
      try {
        // In production, use a QR library like 'qrcode' to generate the QR code
        // For now, we'll provide a mock data URL
        const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invoice/${invoiceId}`;

        // Mock QR data URL (in production, use qrcode library)
        // Example: const qrCode = await QRCode.toDataURL(invoiceUrl);
        const mockDataUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/><text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="10">${invoiceId.slice(0, 8)}</text></svg>`;

        qrCodes.push({
          invoiceId,
          dataUrl: mockDataUrl,
          url: invoiceUrl,
        });
      } catch (error) {
        console.error(`Failed to generate QR for invoice ${invoiceId}:`, error);
        // Continue with next invoice on error
      }
    }

    return NextResponse.json({
      qrCodes,
    });
  } catch (error) {
    console.error("QR batch generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

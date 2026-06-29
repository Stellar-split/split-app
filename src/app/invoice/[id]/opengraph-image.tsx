import { splitClient } from "@/lib/stellar";

export async function generateImageMetadata({
  params,
}: {
  params: { id: string };
}) {
  try {
    const invoice = await splitClient.getInvoice(params.id);
    const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
    const pct = total === 0n ? 0 : Number((invoice.funded * 100n) / total);
    const title = `Invoice #${params.id}`;
    const description = `${pct}% funded · ${invoice.status}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {};
  }
}

export const runtime = "edge";

export default function InvoiceOGImage() {
  return new Response(null, { status: 204 });
}

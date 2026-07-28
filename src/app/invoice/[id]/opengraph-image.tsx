// Per-invoice OG title/description already come from generateMetadata in
// ./layout.tsx. generateImageMetadata must return an array of image variants
// (not a title/description object), so this returns none — the endpoint below
// is a no-op (204) and doesn't need a variant list.
export async function generateImageMetadata() {
  return [];
}

export const runtime = "edge";

export default function InvoiceOGImage() {
  return new Response(null, { status: 204 });
}

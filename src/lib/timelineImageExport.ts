import html2canvas from "html2canvas";

export function getTimelineFilename(invoiceId: string): string {
  return `invoice-${invoiceId}-timeline.png`;
}

export function getTimelineCaption(invoiceId: string, status: string): string {
  return `Invoice #${invoiceId} — ${status}`;
}

export async function exportTimelineAsImage(
  element: HTMLElement,
  invoiceId: string,
  status: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#111827",
    scale: 2,
    useCORS: true,
  });

  const captionHeight = 48;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height + captionHeight;

  const ctx = out.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(canvas, 0, 0);

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, canvas.height, out.width, captionHeight);

  ctx.fillStyle = "#d1d5db";
  ctx.font = `bold ${13 * 2}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    getTimelineCaption(invoiceId, status),
    out.width / 2,
    canvas.height + captionHeight / 2
  );

  const link = document.createElement("a");
  link.download = getTimelineFilename(invoiceId);
  link.href = out.toDataURL("image/png");
  link.click();
}

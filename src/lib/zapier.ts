// Zapier integration helpers
export interface ZapierTrigger { event: string; payload: unknown }
export function buildZapierPayload(event: string, data: unknown) { return { event, data, timestamp: Date.now() }; }
export async function sendToZapier(webhookUrl: string, payload: unknown) {
  const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Zapier delivery failed: ${res.status}`);
  return res;
}
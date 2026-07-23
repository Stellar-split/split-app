interface Recipient {
  address: string;
  amount: string;
}

interface ShareableTemplate {
  recipients: Recipient[];
  token: string;
}

export function encodeTemplate(template: ShareableTemplate): string {
  try {
    const json = JSON.stringify(template);
    const base64 = typeof window !== "undefined"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (err) {
    console.error("Failed to encode template", err);
    throw new Error("Failed to encode template");
  }
}

export function decodeTemplate(encoded: string): ShareableTemplate | null {
  if (!encoded) return null;
  try {
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const json = typeof window !== "undefined"
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.recipients) && typeof parsed.token === "string") {
      return {
        recipients: parsed.recipients.map((r: any) => ({
          address: String(r.address || ""),
          amount: String(r.amount || ""),
        })),
        token: parsed.token,
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to decode template", err);
    return null;
  }
}

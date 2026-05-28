/**
 * Bulk recipient importer — parses CSV and JSON files
 */

interface RecipientRow {
  address: string;
  amount: string;
}

export async function parseCSV(file: File): Promise<RecipientRow[]> {
  const text = await file.text();
  const lines = text.trim().split("\n");
  const rows: RecipientRow[] = [];

  for (const line of lines) {
    const [address, amount] = line.split(",").map((s) => s.trim());
    if (address && amount) {
      rows.push({ address, amount });
    }
  }

  return rows;
}

export async function parseJSON(file: File): Promise<RecipientRow[]> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array of objects");
  }

  return data.map((item) => ({
    address: item.address || "",
    amount: String(item.amount || ""),
  }));
}

export async function parseRecipientFile(file: File): Promise<RecipientRow[]> {
  if (file.type === "application/json" || file.name.endsWith(".json")) {
    return parseJSON(file);
  }
  if (file.type === "text/csv" || file.name.endsWith(".csv")) {
    return parseCSV(file);
  }
  throw new Error("Unsupported file type. Use CSV or JSON.");
}

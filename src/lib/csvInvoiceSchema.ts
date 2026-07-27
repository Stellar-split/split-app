/**
 * CSV to Invoice form field mapping schema.
 * Defines expected column names and validation for CSV imports.
 */

export interface InvoiceFormFields {
  title?: string;
  description?: string;
  amount?: string;
  recipients?: string; // pipe-delimited format: address1:percent1|address2:percent2
  deadline?: string; // ISO date or days from now
  token?: string; // USDC or XLM
}

export interface RecipientLine {
  address: string;
  amount: string;
  percent?: string;
}

// Define the expected column names in CSV
export const EXPECTED_COLUMNS = [
  "title",
  "description",
  "amount",
  "recipients",
  "deadline",
  "token",
];

export type ParsedCSVRow = InvoiceFormFields;

export function parseRecipients(
  recipientString: string
): RecipientLine[] {
  if (!recipientString) return [];

  return recipientString
    .split("|")
    .map((entry) => {
      const [address, percent] = entry.split(":");
      return {
        address: address?.trim() || "",
        amount: "0",
        percent: percent?.trim() || "0",
      };
    })
    .filter((r) => r.address);
}

export function validateInvoiceFormFields(
  data: unknown
): { valid: boolean; data?: ParsedCSVRow; error?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid data format" };
  }

  const typedData = data as Record<string, any>;
  const parsed: ParsedCSVRow = {};

  // Validate and coerce fields
  if (typedData.title && typeof typedData.title === "string") {
    parsed.title = typedData.title;
  }
  if (typedData.description && typeof typedData.description === "string") {
    parsed.description = typedData.description;
  }
  if (typedData.amount) {
    parsed.amount = String(typedData.amount);
  }
  if (typedData.recipients && typeof typedData.recipients === "string") {
    parsed.recipients = typedData.recipients;
  }
  if (typedData.deadline && typeof typedData.deadline === "string") {
    parsed.deadline = typedData.deadline;
  }
  if (typedData.token && typeof typedData.token === "string") {
    parsed.token = typedData.token;
  }

  return { valid: true, data: parsed };
}

export interface ColumnMapping {
  [csvColumn: string]: keyof InvoiceFormFields;
}

export function loadColumnMapping(
  spreadsheetName: string
): ColumnMapping | null {
  if (typeof window === "undefined") return null;

  const key = `csv-mapping-${spreadsheetName}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

export function saveColumnMapping(
  spreadsheetName: string,
  mapping: ColumnMapping
): void {
  if (typeof window === "undefined") return;

  const key = `csv-mapping-${spreadsheetName}`;
  localStorage.setItem(key, JSON.stringify(mapping));
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSVRow(
  text: string
): { columns: string[]; data: { [key: string]: string } } | null {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    return null;
  }

  const headerLine = lines[0];
  const dataLine = lines[1];

  const headers = parseCSVLine(headerLine);
  const values = parseCSVLine(dataLine);

  if (headers.length !== values.length) {
    return null;
  }

  const data: { [key: string]: string } = {};
  headers.forEach((header, idx) => {
    data[header] = values[idx] || "";
  });

  return { columns: headers, data };
}

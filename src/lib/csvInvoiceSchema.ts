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

export interface ValidationError {
  row: number;
  column: string;
  value: string;
  message: string;
}

// Maximum number of validation errors to collect before short-circuiting.
export const MAX_VALIDATION_ERRORS = 20;

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

function validateRowFields(
  typedData: Record<string, any>,
  row: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  const pushError = (column: string, value: unknown, message: string) => {
    if (errors.length >= MAX_VALIDATION_ERRORS) return;
    errors.push({
      row,
      column,
      value: value === undefined || value === null ? "" : String(value),
      message,
    });
  };

  if (typedData.amount !== undefined && typedData.amount !== null && typedData.amount !== "") {
    const amountValue = String(typedData.amount).trim();
    const numericAmount = Number(amountValue);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      pushError("amount", typedData.amount, "Amount must be a positive number");
    }
  }

  if (typedData.recipients && typeof typedData.recipients === "string") {
    const recipients = parseRecipients(typedData.recipients);
    if (recipients.length === 0) {
      pushError(
        "recipients",
        typedData.recipients,
        "Recipients must include at least one address:percent entry"
      );
    } else {
      recipients.forEach((recipient) => {
        const percent = Number(recipient.percent);
        if (!Number.isFinite(percent) || percent <= 0) {
          pushError(
            "recipients",
            recipient.percent ?? "",
            `Recipient percent for ${recipient.address} must be a positive number`
          );
        }
      });
    }
  }

  if (typedData.deadline && typeof typedData.deadline === "string") {
    const deadlineValue = typedData.deadline.trim();
    const asDate = new Date(deadlineValue);
    const isDaysFromNow = /^\d+$/.test(deadlineValue);
    if (!isDaysFromNow && Number.isNaN(asDate.getTime())) {
      pushError(
        "deadline",
        typedData.deadline,
        "Deadline must be an ISO date or a number of days from now"
      );
    }
  }

  if (typedData.token && typeof typedData.token === "string") {
    const tokenValue = typedData.token.trim().toUpperCase();
    if (tokenValue !== "USDC" && tokenValue !== "XLM") {
      pushError("token", typedData.token, "Token must be either USDC or XLM");
    }
  }

  return errors;
}

export function validateInvoiceFormFields(
  data: unknown,
  row: number = 1
): { valid: boolean; data?: ParsedCSVRow; errors: ValidationError[] } {
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      errors: [
        {
          row,
          column: "",
          value: data === undefined || data === null ? "" : String(data),
          message: "Invalid data format",
        },
      ],
    };
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

  const errors = validateRowFields(typedData, row);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: parsed, errors: [] };
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

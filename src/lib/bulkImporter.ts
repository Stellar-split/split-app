/**
 * Bulk recipient importer — parses CSV and JSON files
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * A single recipient row parsed from a CSV or JSON import file.
 *
 * `recipient_address` and `amount` are required.
 * `deadline_days` and `token` are optional — present when the 4-column CSV
 * format (used by the invoice import page) is parsed.
 */
export interface RecipientRow {
  recipient_address: string;
  amount: string;
  deadline_days?: string;
  token?: string;
}

/**
 * Validation result for a single row.
 * `row` is 1-based (matching the CSV row number after the header).
 * An empty `errors` array means the row is valid.
 */
export interface ValidationResult {
  row: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Lightweight Stellar public-key check.
 * Full StrKey checksum validation intentionally omitted to keep this
 * function synchronous and dependency-free.
 */
const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

function isPositiveAmount(amount: string): boolean {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0;
}

// ---------------------------------------------------------------------------
// Public validation API
// ---------------------------------------------------------------------------

/**
 * Validate an array of recipient rows.
 *
 * Checks (all collected per row — no early exit):
 *  1. Stellar address format  (^G[A-Z2-7]{55}$)
 *  2. Positive, finite amount (> 0)
 *  3. Duplicate (recipient_address + amount) pairs within the same batch
 *  4. Positive, finite deadline_days when the field is present
 *  5. Non-empty token when the field is present
 *
 * @returns ValidationResult[] — parallel to `rows`, each with a 1-based
 *          `row` number and an `errors` string array.
 */
export function validateRows(rows: RecipientRow[]): ValidationResult[] {
  // --- Pass 1: detect duplicates ---
  const pairCount = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = `${row.recipient_address}::${row.amount}`;
    const indices = pairCount.get(key) ?? [];
    indices.push(i);
    pairCount.set(key, indices);
  });

  const duplicateIndices = new Set<number>();
  pairCount.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((i) => duplicateIndices.add(i));
    }
  });

  // --- Pass 2: per-row validation ---
  return rows.map((row, i) => {
    const errors: string[] = [];

    if (!isValidStellarAddress(row.recipient_address)) {
      errors.push("Invalid Stellar address (must start with G and be 56 characters)");
    }

    if (!isPositiveAmount(row.amount)) {
      errors.push("Amount must be a positive number");
    }

    if (duplicateIndices.has(i)) {
      errors.push("Duplicate recipient + amount pair within this import");
    }

    if (row.deadline_days !== undefined && row.deadline_days !== "") {
      const d = Number(row.deadline_days);
      if (!Number.isFinite(d) || d <= 0) {
        errors.push("Deadline days must be a positive number");
      }
    }

    if (row.token !== undefined && row.token.trim() === "") {
      errors.push("Token must not be empty");
    }

    return { row: i + 1, errors };
  });
}

// ---------------------------------------------------------------------------
// Legacy parse helpers (unchanged)
// ---------------------------------------------------------------------------

export async function parseCSV(file: File): Promise<RecipientRow[]> {
  const text = await file.text();
  const lines = text.trim().split("\n");
  const rows: RecipientRow[] = [];

  for (const line of lines) {
    const [recipient_address, amount] = line.split(",").map((s) => s.trim());
    if (recipient_address && amount) {
      rows.push({ recipient_address, amount });
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
    recipient_address: item.recipient_address ?? item.address ?? "",
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

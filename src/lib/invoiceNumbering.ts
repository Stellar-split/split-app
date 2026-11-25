const SETTINGS_KEY = "stellarsplit_numbering_settings";
const ASSIGNMENTS_KEY = "stellarsplit_numbering_assignments";

export interface NumberingSettings {
  pattern: string;
}

export interface NumberingAssignment {
  seq: number;
  year: string;
  month: string;
}

export function getNumberingSettings(): NumberingSettings {
  if (typeof window === "undefined") return { pattern: "" };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as NumberingSettings) : { pattern: "" };
  } catch {
    return { pattern: "" };
  }
}

export function saveNumberingSettings(settings: NumberingSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getAssignments(): Record<string, NumberingAssignment> {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, NumberingAssignment>) : {};
  } catch {
    return {};
  }
}

function saveAssignments(assignments: Record<string, NumberingAssignment>): void {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

function nextSeq(assignments: Record<string, NumberingAssignment>): number {
  const values = Object.values(assignments);
  if (values.length === 0) return 1;
  return Math.max(...values.map((a) => a.seq)) + 1;
}

export function applyPattern(pattern: string, assignment: NumberingAssignment): string {
  return pattern
    .replace("{YYYY}", assignment.year)
    .replace("{MM}", assignment.month)
    .replace("{seq}", String(assignment.seq).padStart(3, "0"));
}

export function getOrAssignDisplayNumber(
  invoiceId: string,
  referenceDate?: Date
): string {
  const settings = getNumberingSettings();
  if (!settings.pattern) return "";

  const assignments = getAssignments();
  if (!assignments[invoiceId]) {
    const date = referenceDate ?? new Date();
    assignments[invoiceId] = {
      seq: nextSeq(assignments),
      year: date.getFullYear().toString(),
      month: String(date.getMonth() + 1).padStart(2, "0"),
    };
    saveAssignments(assignments);
  }

  return applyPattern(settings.pattern, assignments[invoiceId]);
}

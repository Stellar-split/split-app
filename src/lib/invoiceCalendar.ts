export interface CalendarInvoice {
  id: string;
  /** Unix timestamp deadline in seconds; 0 means no deadline. */
  deadline: number;
  status: string;
}

export interface CalendarDay<T extends CalendarInvoice = CalendarInvoice> {
  /** Local date key in YYYY-MM-DD form. */
  key: string;
  date: Date;
  inMonth: boolean;
  invoices: T[];
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Group invoices by the local calendar day of their deadline, skipping invoices without one. */
export function groupByDeadline<T extends CalendarInvoice>(invoices: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const inv of invoices) {
    if (!inv.deadline) continue;
    const key = dateKey(new Date(inv.deadline * 1000));
    const list = map.get(key);
    if (list) list.push(inv);
    else map.set(key, [inv]);
  }
  return map;
}

/** Build a 6-week (42 day) Sunday-first grid covering the given month. */
export function buildMonthGrid<T extends CalendarInvoice>(
  year: number,
  month: number,
  invoices: T[]
): CalendarDay<T>[] {
  const grouped = groupByDeadline(invoices);
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(date);
    return { key, date, inMonth: date.getMonth() === month, invoices: grouped.get(key) ?? [] };
  });
}

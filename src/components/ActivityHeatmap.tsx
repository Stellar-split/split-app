"use client";

import { useMemo, useState } from "react";
import type { Invoice } from "@stellar-split/sdk";

interface ActivityHeatmapProps {
  invoices: Invoice[];
}

const WEEKS = 52;
const DAYS = 7;

/** Colour scale: 0 = empty, 1–4 = intensity levels */
function intensityClass(count: number): string {
  if (count === 0) return "fill-gray-800";
  if (count === 1) return "fill-indigo-900";
  if (count === 2) return "fill-indigo-700";
  if (count === 3) return "fill-indigo-500";
  return "fill-indigo-400";
}

/** Format a Date as YYYY-MM-DD */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Return the Monday of the week containing `d` */
function weekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export default function ActivityHeatmap({ invoices }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  // Build a map of dateKey -> payment count
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) {
      for (const payment of inv.payments ?? []) {
        // Payment timestamps are unix seconds; fall back to today if missing
        const ts = (payment as { timestamp?: number }).timestamp;
        const d = ts ? new Date(ts * 1000) : new Date();
        const key = toDateKey(d);
        map[key] = (map[key] ?? 0) + 1;
      }
    }
    return map;
  }, [invoices]);

  // Build the 52×7 grid anchored to today
  const { grid, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from the Monday 52 weeks ago
    const start = weekStart(new Date(today.getTime() - (WEEKS - 1) * 7 * 86400_000));

    const grid: Array<Array<{ date: string; count: number }>> = [];
    const monthsSeen = new Set<string>();
    const monthLabels: Array<{ label: string; col: number }> = [];

    for (let w = 0; w < WEEKS; w++) {
      const week: Array<{ date: string; count: number }> = [];
      for (let d = 0; d < DAYS; d++) {
        const cell = new Date(start.getTime() + (w * 7 + d) * 86400_000);
        const key = toDateKey(cell);
        week.push({ date: key, count: countByDate[key] ?? 0 });

        // Track month label for the first day of each month
        const monthKey = key.slice(0, 7);
        if (!monthsSeen.has(monthKey) && d === 0) {
          monthsSeen.add(monthKey);
          monthLabels.push({
            label: cell.toLocaleDateString(undefined, { month: "short" }),
            col: w,
          });
        }
      }
      grid.push(week);
    }

    return { grid, monthLabels };
  }, [countByDate]);

  const CELL = 12;
  const GAP = 2;
  const STEP = CELL + GAP;
  const LABEL_H = 18;
  const svgW = WEEKS * STEP;
  const svgH = LABEL_H + DAYS * STEP;

  return (
    <div className="relative overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        role="img"
        aria-label="Payment activity heatmap for the last 52 weeks"
        className="min-w-[400px]"
      >
        {/* Month labels */}
        {monthLabels.map(({ label, col }) => (
          <text
            key={`${label}-${col}`}
            x={col * STEP}
            y={LABEL_H - 4}
            className="fill-gray-400 text-[10px]"
            fontSize={10}
            fill="#9ca3af"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {grid.map((week, w) =>
          week.map((cell, d) => (
            <rect
              key={cell.date}
              x={w * STEP}
              y={LABEL_H + d * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              ry={2}
              className={`${intensityClass(cell.count)} cursor-pointer transition-opacity hover:opacity-80`}
              onMouseEnter={(e) => {
                const rect = (e.target as SVGRectElement).getBoundingClientRect();
                setTooltip({ date: cell.date, count: cell.count, x: rect.left, y: rect.top });
              }}
              onMouseLeave={() => setTooltip(null)}
              aria-label={`${cell.date}: ${cell.count} payment${cell.count !== 1 ? "s" : ""}`}
            />
          ))
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 shadow-lg"
          style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}
          role="tooltip"
        >
          <span className="font-semibold">{tooltip.date}</span>
          <br />
          {tooltip.count} payment{tooltip.count !== 1 ? "s" : ""}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <svg key={level} width={12} height={12} aria-hidden="true">
            <rect
              width={12}
              height={12}
              rx={2}
              className={intensityClass(level)}
            />
          </svg>
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

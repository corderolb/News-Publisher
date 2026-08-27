import type { ReactNode } from "react";

type StatTone = "default" | "success" | "warning" | "danger";

const VALUE_TONE_CLASS: Record<StatTone, string> = {
  default: "text-[var(--primary-strong)]",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
};

type Columns = 2 | 3 | 4 | 5;

const COLS_CLASS: Record<Columns, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

export type Stat = { label: string; value: ReactNode; tone?: StatTone };

type StatGridProps = { stats: Stat[]; columns?: Columns; className?: string };

// Shared stat-tile row. Always renders 2 columns on phones (was previously
// a hard 4-column grid with no breakpoint on at least one page) and steps up
// to `columns` (or the stat count, clamped 2-5) from `sm:` up.
export default function StatGrid({ stats, columns, className = "" }: StatGridProps) {
  const cols = columns ?? (Math.min(5, Math.max(2, stats.length)) as Columns);

  return (
    <div className={`grid grid-cols-2 gap-2 text-xs ${COLS_CLASS[cols]} ${className}`.trim()}>
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center">
          <p className="font-semibold text-[var(--muted)]">{stat.label}</p>
          <p className={`text-base font-extrabold ${VALUE_TONE_CLASS[stat.tone ?? "default"]}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

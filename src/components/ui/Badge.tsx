import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

type BadgeProps = { tone?: BadgeTone; children: ReactNode; className?: string };

// Shared status/tone pill - replaces the 7+ separate ad-hoc tone maps that
// used to reimplement this same bordered-pill markup per page. Callers keep
// their own domain-specific status->tone mapping (that part is inherently
// page-specific); only the rendering is shared here.
export default function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold ${TONE_CLASS[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}

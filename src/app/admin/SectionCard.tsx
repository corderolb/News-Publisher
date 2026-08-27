import type { ReactNode } from "react";

type SectionCardProps = {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

// Shared "labeled field group" treatment used anywhere a form is split into
// logical sections (Job edit form, Newsletter config) - gives each group its
// own visually contained card instead of a bare uppercase label floating
// above plain fields.
export default function SectionCard({ icon, title, action, children }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
            {icon}
          </span>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

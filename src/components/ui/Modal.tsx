"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: "md" | "2xl" | "3xl";
  closeLabel?: string;
  /** Smaller chrome for short confirm-style dialogs (matches the old DeleteConfirmButton look). */
  compact?: boolean;
};

const MAX_WIDTH_CLASS: Record<NonNullable<ModalProps["maxWidth"]>, string> = {
  md: "sm:max-w-md",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
};

// Responsive by default: a bottom sheet on phones (easier to reach/dismiss
// with a thumb, and avoids a centered dialog clipping against the keyboard),
// a centered dialog from `sm:` up. `max-h-[85vh]` + inner scroll keeps long
// forms usable on short viewports instead of overflowing off-screen.
export default function Modal({ open, onClose, title, children, maxWidth = "2xl", closeLabel = "Schliessen", compact = false }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={
          `flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl outline-none sm:rounded-2xl ${MAX_WIDTH_CLASS[maxWidth]} ` +
          (compact ? "p-5" : "p-6")
        }
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className={compact ? "text-base font-extrabold text-[var(--primary-strong)]" : "text-xl font-extrabold text-[var(--primary-strong)]"}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-alt)]"
          >
            {closeLabel}
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

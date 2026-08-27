"use client";

import { useState } from "react";

type DeleteConfirmButtonProps = {
  triggerLabel?: string;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerClassName?: string;
  confirmClassName?: string;
};

export default function DeleteConfirmButton({
  triggerLabel = "Loeschen",
  title = "Bitte bestaetigen",
  message,
  confirmLabel = "Ja, loeschen",
  cancelLabel = "Abbrechen",
  triggerClassName = "rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--off-fg)]",
  confirmClassName = "rounded-md bg-[var(--off-fg)] px-3 py-1.5 text-xs font-semibold text-white",
}: DeleteConfirmButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-[var(--primary-strong)]">{title}</h3>
            <p className="mt-2 text-sm text-[var(--foreground)]">{message}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
              >
                {cancelLabel}
              </button>
              <button type="submit" className={confirmClassName}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

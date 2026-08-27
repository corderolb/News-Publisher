"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";

type DeleteConfirmButtonProps = {
  triggerLabel?: string;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerClassName?: string;
  confirmClassName?: string;
};

// Must be rendered inside the <form action={deleteAction}> it confirms for -
// the confirm button is a plain type="submit" that submits that form.
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

      <Modal open={open} onClose={() => setOpen(false)} title={title} maxWidth="md" compact>
        <p className="text-sm text-[var(--foreground)]">{message}</p>

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
      </Modal>
    </>
  );
}

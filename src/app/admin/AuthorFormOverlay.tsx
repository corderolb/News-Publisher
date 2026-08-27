"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Label, TextInput } from "@/components/ui/Field";

type AuthorForEdit = {
  id: string;
  name: string;
  tone: string;
  bio: string | null;
  instructions: string | null;
};

type AuthorFormOverlayProps = {
  action: (formData: FormData) => Promise<void>;
  author?: AuthorForEdit;
};

// Handles both "create" and "edit" - the two used to be near-identical
// copy-pasted components (AuthorOverlay / AuthorEditOverlay) differing only
// in defaults, the hidden id field, and the create-only "default author"
// checkbox.
export default function AuthorFormOverlay({ action, author }: AuthorFormOverlayProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(author);

  return (
    <>
      {isEdit ? (
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[var(--primary)] hover:underline">
          Bearbeiten
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Oeffnet die Autorenmaske"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
        >
          <span className="text-lg leading-none">+</span>
          <span>Autor anlegen</span>
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? "Autor bearbeiten" : "Neuen Autor anlegen"} maxWidth="3xl">
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          className="grid gap-4 md:grid-cols-12"
        >
          {isEdit && <input type="hidden" name="id" value={author!.id} />}

          <div className="md:col-span-3">
            <Label title="Anzeigename fuer den Autor">Name</Label>
            <TextInput type="text" name="name" required defaultValue={author?.name} placeholder="Anna Investigativ" />
          </div>

          <div className="md:col-span-3">
            <Label title="Schreibstil fuer die KI-Generierung">Tonalitaet</Label>
            <TextInput type="text" name="tone" required defaultValue={author?.tone} placeholder="Klar, investigativ, faktenbasiert" />
          </div>

          <div className="md:col-span-3">
            <Label title="Kurze Redaktionsbeschreibung">Bio</Label>
            <TextInput type="text" name="bio" defaultValue={author?.bio || ""} placeholder="Fokus auf Quellenabgleich" />
          </div>

          <div className="md:col-span-3">
            <Label title="Zusaetzliche Prompt-Regeln">Extra-Regeln</Label>
            <TextInput
              type="text"
              name="instructions"
              defaultValue={author?.instructions || ""}
              placeholder="Immer Quellen vorsichtig einordnen"
            />
          </div>

          <div className={`md:col-span-12 flex flex-wrap items-center gap-4 ${isEdit ? "justify-end" : "justify-between"}`}>
            {!isEdit && (
              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-[var(--border)]" />
                Als Standardautor setzen
              </label>
            )}
            <button
              type="submit"
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              {isEdit ? "Aenderungen speichern" : "Autor speichern"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Label, SelectInput, TextInput } from "@/components/ui/Field";

type SourceForEdit = {
  id: string;
  name: string;
  url: string;
  category: string;
  type: "RSS" | "HTML";
};

type SourceFormOverlayProps = {
  action: (formData: FormData) => Promise<void>;
  source?: SourceForEdit;
};

// Handles both "create" and "edit" - the two used to be near-identical
// copy-pasted components (SourceOverlay / SourceEditOverlay).
export default function SourceFormOverlay({ action, source }: SourceFormOverlayProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(source);

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
          title="Oeffnet die Quellenmaske als Overlay"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
        >
          <span className="text-lg leading-none">+</span>
          <span>Neue Quelle</span>
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? "Quelle bearbeiten" : "Neue Quelle hinzufuegen"} maxWidth="3xl">
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          className="grid gap-4 md:grid-cols-6"
        >
          {isEdit && <input type="hidden" name="id" value={source!.id} />}

          <div className="md:col-span-2">
            <Label title="Anzeigename der Quelle im Dashboard und bei Artikeln">Name</Label>
            <TextInput type="text" name="name" required defaultValue={source?.name} placeholder="z.B. Hollywood Reporter" />
          </div>

          <div className="md:col-span-4">
            <Label title="Startseite oder Feed-URL, die gecrawlt werden soll">URL</Label>
            <TextInput type="url" name="url" required defaultValue={source?.url} placeholder="https://..." />
          </div>

          <div className="md:col-span-3">
            <Label title="Hilft der KI bei Einordnung und Recherchefokus">Kategorie</Label>
            <TextInput type="text" name="category" defaultValue={source?.category} placeholder="entertainment" />
          </div>

          <div className="md:col-span-3">
            <Label title="RSS liest Feed-Eintraege, Webseite durchsucht Links direkt">Typ</Label>
            <SelectInput name="type" defaultValue={source?.type ?? "RSS"}>
              <option value="RSS">RSS</option>
              <option value="HTML">Webseite</option>
            </SelectInput>
          </div>

          <div className={`md:col-span-6 flex items-center gap-4 ${isEdit ? "justify-end" : "justify-between"}`}>
            {!isEdit && (
              <p className="text-xs text-[var(--muted)]">Tipp: HTML eignet sich gut fuer Portale ohne RSS-Feed.</p>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              {isEdit ? "Aenderungen speichern" : "Quelle speichern"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

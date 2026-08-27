"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Label, SelectInput, TextInput, TextareaInput } from "@/components/ui/Field";

type NewsletterOverlayProps = {
  createAction: (formData: FormData) => Promise<void>;
};

export default function NewsletterOverlay({ createAction }: NewsletterOverlayProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
      >
        <span className="text-lg leading-none">+</span>
        <span>Neuer Newsletter</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Neuen Newsletter anlegen">
        <form
          action={async (formData) => {
            await createAction(formData);
            setOpen(false);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <TextInput name="name" required placeholder="Morgen-Digest" />
          </div>

          <div>
            <Label>Frequenz</Label>
            <SelectInput name="cadence" defaultValue="WEEKLY">
              <option value="DAILY">Taeglich</option>
              <option value="WEEKLY">Woechentlich (letzte 7 Tage)</option>
              <option value="MONTHLY">Monatlich (letzte 30 Tage)</option>
            </SelectInput>
          </div>

          <div>
            <Label>Sendezeit</Label>
            <TextInput name="sendHour" type="time" defaultValue="08:00" required />
          </div>

          <div className="sm:col-span-2">
            <Label>Betreff</Label>
            <TextInput name="subjectTemplate" defaultValue="Deine Top-Artikel" required />
          </div>

          <div>
            <Label>Top-Artikel</Label>
            <TextInput name="topN" type="number" min={1} max={20} defaultValue={5} />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <input name="active" type="checkbox" className="h-4 w-4" />
              Sofort aktivieren
            </label>
          </div>

          <div className="sm:col-span-2">
            <Label>
              Empfaenger <span className="font-normal text-[var(--muted)]">(kommagetrennt oder eine E-Mail pro Zeile)</span>
            </Label>
            <TextareaInput name="recipients" rows={3} placeholder="redaktion@spielfilm.de, marketing@spielfilm.de" />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              Newsletter speichern
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

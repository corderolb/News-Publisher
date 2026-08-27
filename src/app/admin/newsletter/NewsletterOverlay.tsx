"use client";

import { useState } from "react";

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

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--primary-strong)]">Neuen Newsletter anlegen</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-alt)]"
              >
                Schliessen
              </button>
            </div>

            <form
              action={async (formData) => {
                await createAction(formData);
                setOpen(false);
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Name</label>
                <input
                  name="name"
                  required
                  placeholder="Morgen-Digest"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Frequenz</label>
                <select
                  name="cadence"
                  defaultValue="WEEKLY"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                >
                  <option value="DAILY">Taeglich</option>
                  <option value="WEEKLY">Woechentlich (letzte 7 Tage)</option>
                  <option value="MONTHLY">Monatlich (letzte 30 Tage)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Sendezeit</label>
                <input
                  name="sendHour"
                  type="time"
                  defaultValue="08:00"
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Betreff</label>
                <input
                  name="subjectTemplate"
                  defaultValue="Deine Top-Artikel"
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Top-Artikel</label>
                <input
                  name="topN"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={5}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
              </div>

              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <input name="active" type="checkbox" className="h-4 w-4" />
                  Sofort aktivieren
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">
                  Empfaenger <span className="font-normal text-[var(--muted)]">(kommagetrennt oder eine E-Mail pro Zeile)</span>
                </label>
                <textarea
                  name="recipients"
                  rows={3}
                  placeholder="redaktion@spielfilm.de, marketing@spielfilm.de"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
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
          </div>
        </div>
      )}
    </>
  );
}

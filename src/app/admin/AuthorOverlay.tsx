"use client";

import { useState } from "react";

type AuthorOverlayProps = {
  addAuthorAction: (formData: FormData) => Promise<void>;
};

export default function AuthorOverlay({ addAuthorAction }: AuthorOverlayProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Oeffnet die Autorenmaske"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
      >
        <span className="text-lg leading-none">+</span>
        <span>Autor anlegen</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--primary-strong)]">Neuen Autor anlegen</h2>
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
                await addAuthorAction(formData);
                setOpen(false);
              }}
              className="grid gap-4 md:grid-cols-12"
            >
              <div className="md:col-span-3">
                <label
                  title="Anzeigename fuer den Autor"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="Anna Investigativ"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  title="Schreibstil fuer die KI-Generierung"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Tonalitaet
                </label>
                <input
                  type="text"
                  name="tone"
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="Klar, investigativ, faktenbasiert"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  title="Kurze Redaktionsbeschreibung"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Bio
                </label>
                <input
                  type="text"
                  name="bio"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="Fokus auf Quellenabgleich"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  title="Zusaetzliche Prompt-Regeln"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Extra-Regeln
                </label>
                <input
                  type="text"
                  name="instructions"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="Immer Quellen vorsichtig einordnen"
                />
              </div>

              <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-[var(--border)]" />
                  Als Standardautor setzen
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                >
                  Autor speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

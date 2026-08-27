"use client";

import { useState } from "react";

type SourceOverlayProps = {
  addSourceAction: (formData: FormData) => Promise<void>;
};

export default function SourceOverlay({ addSourceAction }: SourceOverlayProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Oeffnet die Quellenmaske als Overlay"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
      >
        <span className="text-lg leading-none">+</span>
        <span>Neue Quelle</span>
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
              <h2 className="text-xl font-extrabold text-[var(--primary-strong)]">Neue Quelle hinzufuegen</h2>
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
                await addSourceAction(formData);
                setOpen(false);
              }}
              className="grid gap-4 md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <label
                  title="Anzeigename der Quelle im Dashboard und bei Artikeln"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="z.B. Hollywood Reporter"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  title="Startseite oder Feed-URL, die gecrawlt werden soll"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  URL
                </label>
                <input
                  type="url"
                  name="url"
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label
                  title="Hilft der KI bei Einordnung und Recherchefokus"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Kategorie
                </label>
                <input
                  type="text"
                  name="category"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="entertainment"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  title="RSS liest Feed-Eintraege, Webseite durchsucht Links direkt"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Typ
                </label>
                <select
                  name="type"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  defaultValue="RSS"
                >
                  <option value="RSS">RSS</option>
                  <option value="HTML">Webseite</option>
                </select>
              </div>

              <div className="md:col-span-6 flex items-center justify-between gap-4">
                <p className="text-xs text-[var(--muted)]">
                  Tipp: HTML eignet sich gut fuer Portale ohne RSS-Feed.
                </p>
                <button
                  type="submit"
                  title="Speichert die Quelle und startet noch keine Pipeline"
                  className="inline-flex items-center rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                >
                  Quelle speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

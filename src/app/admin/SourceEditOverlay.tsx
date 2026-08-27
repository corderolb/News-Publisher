"use client";

import { useState } from "react";

type SourceForEdit = {
  id: string;
  name: string;
  url: string;
  category: string;
  type: "RSS" | "HTML";
};

type SourceEditOverlayProps = {
  source: SourceForEdit;
  updateSourceAction: (formData: FormData) => Promise<void>;
};

export default function SourceEditOverlay({ source, updateSourceAction }: SourceEditOverlayProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[var(--primary)] hover:underline">
        Bearbeiten
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--primary-strong)]">Quelle bearbeiten</h2>
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
                await updateSourceAction(formData);
                setOpen(false);
              }}
              className="grid gap-4 md:grid-cols-6"
            >
              <input type="hidden" name="id" value={source.id} />

              <div className="md:col-span-2">
                <label
                  title="Anzeigename der Quelle"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={source.name}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                />
              </div>

              <div className="md:col-span-4">
                <label
                  title="Feed- oder Webseiten-URL"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  URL
                </label>
                <input
                  type="url"
                  name="url"
                  required
                  defaultValue={source.url}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  title="Themenbereich fuer die Quelle"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Kategorie
                </label>
                <input
                  type="text"
                  name="category"
                  defaultValue={source.category}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  title="RSS oder HTML-Crawl"
                  className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]"
                >
                  Typ
                </label>
                <select
                  name="type"
                  defaultValue={source.type}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                >
                  <option value="RSS">RSS</option>
                  <option value="HTML">Webseite</option>
                </select>
              </div>

              <div className="md:col-span-6 flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                >
                  Aenderungen speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

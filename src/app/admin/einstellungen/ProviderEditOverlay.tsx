"use client";

import { useState } from "react";

type ProviderForEdit = {
  id: string;
  name: string;
  baseURL: string;
  hasApiKey: boolean;
};

type ProviderEditOverlayProps = {
  provider: ProviderForEdit;
  updateProviderAction: (formData: FormData) => Promise<void>;
};

export default function ProviderEditOverlay({ provider, updateProviderAction }: ProviderEditOverlayProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[var(--primary)] hover:underline">
        Bearbeiten
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--primary-strong)]">Provider bearbeiten</h2>
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
                await updateProviderAction(formData);
                setOpen(false);
              }}
              className="grid gap-4 md:grid-cols-6"
            >
              <input type="hidden" name="id" value={provider.id} />

              <div className="md:col-span-6">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={provider.name}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                />
              </div>

              <div className="md:col-span-6">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">Base URL</label>
                <input
                  type="text"
                  name="baseURL"
                  required
                  defaultValue={provider.baseURL}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                />
              </div>

              <div className="md:col-span-6">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">
                  API-Key {provider.hasApiKey ? "(gesetzt - zum Aendern neu eingeben)" : "(optional)"}
                </label>
                <input
                  type="password"
                  name="apiKey"
                  autoComplete="off"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder={provider.hasApiKey ? "Unveraendert lassen: leer" : "sk-..."}
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Leer lassen, um den gespeicherten Schluessel zu behalten. Wird im Klartext gespeichert.
                </p>
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

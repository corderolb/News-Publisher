"use client";

import { useState } from "react";

const PRESETS: Record<string, { baseURL: string; needsKey: boolean }> = {
  "LM Studio": { baseURL: "http://localhost:1234/v1", needsKey: false },
  Ollama: { baseURL: "http://localhost:11434/v1", needsKey: false },
  OpenAI: { baseURL: "https://api.openai.com/v1", needsKey: true },
  OpenRouter: { baseURL: "https://openrouter.ai/api/v1", needsKey: true },
  Custom: { baseURL: "", needsKey: false },
};

type ProviderOverlayProps = {
  addProviderAction: (formData: FormData) => Promise<void>;
};

export default function ProviderOverlay({ addProviderAction }: ProviderOverlayProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("LM Studio");
  const [baseURL, setBaseURL] = useState(PRESETS["LM Studio"].baseURL);

  function handlePresetChange(value: string) {
    setPreset(value);
    setBaseURL(PRESETS[value]?.baseURL ?? "");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
      >
        <span className="text-lg leading-none">+</span>
        <span>Provider hinzufuegen</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--primary-strong)]">Neuer LLM-Provider</h2>
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
                await addProviderAction(formData);
                setOpen(false);
                setPreset("LM Studio");
                setBaseURL(PRESETS["LM Studio"].baseURL);
              }}
              className="grid gap-4 md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">Preset</label>
                <select
                  value={preset}
                  onChange={(event) => handlePresetChange(event.target.value)}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                >
                  {Object.keys(PRESETS).map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={preset === "Custom" ? "" : preset}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="z.B. LM Studio (lokal)"
                />
              </div>

              <div className="md:col-span-6">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">Base URL</label>
                <input
                  type="text"
                  name="baseURL"
                  required
                  value={baseURL}
                  onChange={(event) => setBaseURL(event.target.value)}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="https://api.openai.com/v1"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Fuer Docker-Deployments mit LM Studio auf dem Host: http://host.docker.internal:1234/v1
                </p>
              </div>

              <div className="md:col-span-6">
                <label className="mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]">
                  API-Key (optional)
                </label>
                <input
                  type="password"
                  name="apiKey"
                  autoComplete="off"
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2"
                  placeholder="sk-..."
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Wird im Klartext gespeichert (wie der Rest der App-Konfiguration). Leer lassen fuer lokale
                  Server ohne Schluessel (LM Studio, Ollama).
                </p>
              </div>

              <div className="md:col-span-6 flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                >
                  Provider speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

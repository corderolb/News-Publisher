"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Label, SelectInput, TextInput } from "@/components/ui/Field";

const PRESETS: Record<string, { baseURL: string; needsKey: boolean }> = {
  "LM Studio": { baseURL: "http://localhost:1234/v1", needsKey: false },
  Ollama: { baseURL: "http://localhost:11434/v1", needsKey: false },
  OpenAI: { baseURL: "https://api.openai.com/v1", needsKey: true },
  OpenRouter: { baseURL: "https://openrouter.ai/api/v1", needsKey: true },
  Custom: { baseURL: "", needsKey: false },
};

type ProviderForEdit = { id: string; name: string; baseURL: string; hasApiKey: boolean };

type ProviderFormOverlayProps = {
  action: (formData: FormData) => Promise<void>;
  provider?: ProviderForEdit;
};

// Handles both "create" and "edit" - the two used to be near-identical
// copy-pasted components (ProviderOverlay / ProviderEditOverlay); create
// keeps the extra preset dropdown that pre-fills name/baseURL.
export default function ProviderFormOverlay({ action, provider }: ProviderFormOverlayProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("LM Studio");
  const [baseURL, setBaseURL] = useState(PRESETS["LM Studio"].baseURL);
  const isEdit = Boolean(provider);

  function handlePresetChange(value: string) {
    setPreset(value);
    setBaseURL(PRESETS[value]?.baseURL ?? "");
  }

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
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
        >
          <span className="text-lg leading-none">+</span>
          <span>Provider hinzufuegen</span>
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? "Provider bearbeiten" : "Neuer LLM-Provider"}>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
            if (!isEdit) {
              setPreset("LM Studio");
              setBaseURL(PRESETS["LM Studio"].baseURL);
            }
          }}
          className="grid gap-4 md:grid-cols-6"
        >
          {isEdit && <input type="hidden" name="id" value={provider!.id} />}

          {!isEdit && (
            <div className="md:col-span-2">
              <Label>Preset</Label>
              <SelectInput value={preset} onChange={(event) => handlePresetChange(event.target.value)}>
                {Object.keys(PRESETS).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </SelectInput>
            </div>
          )}

          <div className={isEdit ? "md:col-span-6" : "md:col-span-4"}>
            <Label>Name</Label>
            <TextInput
              type="text"
              name="name"
              required
              defaultValue={isEdit ? provider!.name : preset === "Custom" ? "" : preset}
              placeholder="z.B. LM Studio (lokal)"
            />
          </div>

          <div className="md:col-span-6">
            <Label>Base URL</Label>
            {isEdit ? (
              <TextInput type="text" name="baseURL" required defaultValue={provider!.baseURL} />
            ) : (
              <>
                <TextInput
                  type="text"
                  name="baseURL"
                  required
                  value={baseURL}
                  onChange={(event) => setBaseURL(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Fuer Docker-Deployments mit LM Studio auf dem Host: http://host.docker.internal:1234/v1
                </p>
              </>
            )}
          </div>

          <div className="md:col-span-6">
            <Label>
              API-Key {isEdit ? (provider!.hasApiKey ? "(gesetzt - zum Aendern neu eingeben)" : "(optional)") : "(optional)"}
            </Label>
            <TextInput
              type="password"
              name="apiKey"
              autoComplete="off"
              placeholder={isEdit ? (provider!.hasApiKey ? "Unveraendert lassen: leer" : "sk-...") : "sk-..."}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {isEdit
                ? "Leer lassen, um den gespeicherten Schluessel zu behalten. Wird im Klartext gespeichert."
                : "Wird im Klartext gespeichert (wie der Rest der App-Konfiguration). Leer lassen fuer lokale Server ohne Schluessel (LM Studio, Ollama)."}
            </p>
          </div>

          <div className="md:col-span-6 flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              {isEdit ? "Aenderungen speichern" : "Provider speichern"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";

type ModelOption = { id: string; type: string; state: string };
type ProviderOption = { id: string; name: string };

type ModelRoleSelectorProps = {
  role: "primary" | "embedding";
  providers: ProviderOption[];
  envDefaultProviderId: string;
  envDefaultLabel: string;
  modelsByProvider: Record<string, ModelOption[]>;
  initialProviderId: string;
  initialModel: string | null;
  autoModelLabel: string;
  allowedTypes: string[];
};

export default function ModelRoleSelector({
  role,
  providers,
  envDefaultProviderId,
  envDefaultLabel,
  modelsByProvider,
  initialProviderId,
  initialModel,
  autoModelLabel,
  allowedTypes,
}: ModelRoleSelectorProps) {
  const [providerId, setProviderId] = useState(initialProviderId);
  const [modelValue, setModelValue] = useState(initialModel || "");

  function handleProviderChange(nextProviderId: string) {
    setProviderId(nextProviderId);
    // Switching provider: the previously selected model almost never exists
    // on the new provider, so fall back to "automatic" rather than silently
    // keeping a now-meaningless model id.
    setModelValue("");
  }

  const models = (modelsByProvider[providerId] || []).filter((m) => allowedTypes.includes(m.type));
  const options = models.map((m) => ({
    value: m.id,
    label: `${m.id}${m.state === "loaded" ? "  •  geladen" : ""}`,
  }));
  if (modelValue && !models.some((m) => m.id === modelValue)) {
    options.unshift({ value: modelValue, label: `${modelValue}  •  nicht in aktueller Liste` });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 flex items-center text-xs font-semibold text-[var(--foreground)]">Provider</label>
        <select
          name={`${role}ProviderId`}
          value={providerId}
          onChange={(event) => handleProviderChange(event.target.value)}
          className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
        >
          <option value={envDefaultProviderId}>{envDefaultLabel}</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 flex items-center text-xs font-semibold text-[var(--foreground)]">Modell</label>
        {options.length > 0 ? (
          <select
            name={`${role}Model`}
            value={modelValue}
            onChange={(event) => setModelValue(event.target.value)}
            className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
          >
            <option value="">{autoModelLabel}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            name={`${role}Model`}
            value={modelValue}
            onChange={(event) => setModelValue(event.target.value)}
            placeholder="Modell-ID manuell eingeben (z.B. gpt-4o-mini)"
            className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
          />
        )}
      </div>
    </div>
  );
}

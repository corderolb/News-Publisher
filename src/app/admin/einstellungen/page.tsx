import { revalidatePath } from "next/cache";
import {
  getModelSettingsForAdmin,
  updateModelSettings,
  createLlmProvider,
  updateLlmProvider,
  deleteLlmProvider,
  ENV_DEFAULT_PROVIDER_ID,
} from "@/lib/llm-settings";
import { prisma } from "@/lib/prisma";
import { CheckIcon, DatabaseIcon, WandIcon, WarningIcon } from "@/app/admin/JobIcons";
import RefreshButton from "@/app/admin/einstellungen/RefreshButton";
import ProviderFormOverlay from "@/app/admin/einstellungen/ProviderFormOverlay";
import ModelRoleSelector from "@/app/admin/einstellungen/ModelRoleSelector";
import DeleteConfirmButton from "@/app/admin/DeleteConfirmButton";
import PageContainer from "@/components/ui/PageContainer";

export default async function EinstellungenPage() {
  async function addProviderAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const baseURL = String(formData.get("baseURL") || "").trim();
    const apiKey = String(formData.get("apiKey") || "").trim();

    if (!name || !baseURL) return;

    await createLlmProvider({ name, baseURL, apiKey: apiKey || null });

    revalidatePath("/admin/einstellungen");
  }

  async function updateProviderAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    const baseURL = String(formData.get("baseURL") || "").trim();
    const apiKeyInput = String(formData.get("apiKey") || "").trim();

    if (!id || !name || !baseURL) return;

    // Empty input means "keep the currently stored key" - the field is
    // always rendered blank for security, so blank alone can't mean "clear
    // it" without an extra explicit control this app doesn't have yet.
    if (apiKeyInput) {
      await updateLlmProvider(id, { name, baseURL, apiKey: apiKeyInput });
    } else {
      const existing = await prisma.llmProvider.findUnique({ where: { id } });
      await updateLlmProvider(id, { name, baseURL, apiKey: existing?.apiKey ?? null });
    }

    revalidatePath("/admin/einstellungen");
  }

  async function deleteProviderAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") || "");
    if (!id) return;

    await deleteLlmProvider(id);

    revalidatePath("/admin/einstellungen");
  }

  async function updateModelSettingsAction(formData: FormData) {
    "use server";

    const primaryProviderId = String(formData.get("primaryProviderId") || ENV_DEFAULT_PROVIDER_ID);
    const primaryModelRaw = String(formData.get("primaryModel") || "").trim();
    const embeddingProviderId = String(formData.get("embeddingProviderId") || ENV_DEFAULT_PROVIDER_ID);
    const embeddingModelRaw = String(formData.get("embeddingModel") || "").trim();

    await updateModelSettings({
      primaryProviderId,
      primaryModel: primaryModelRaw || null,
      embeddingProviderId,
      embeddingModel: embeddingModelRaw || null,
    });

    revalidatePath("/admin/einstellungen");
  }

  const settings = await getModelSettingsForAdmin();
  const providerRows = settings.providers;

  const envDefaultModels = settings.modelsByProvider[ENV_DEFAULT_PROVIDER_ID] || [];
  const envDefaultReachable = envDefaultModels.length > 0;

  return (
    <PageContainer>
      <div className="mb-6 max-w-2xl">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          LLM-Provider verwalten (LM Studio, OpenAI, OpenRouter, Ollama oder ein beliebiger
          OpenAI-kompatibler Endpunkt) und festlegen, welcher Provider + Modell fuer Text-Generierung und
          welcher fuer Embeddings verwendet wird.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Provider-Verwaltung</p>
          <ProviderFormOverlay action={addProviderAction} />
        </div>

        <div
          className={`mb-4 flex items-start gap-3 rounded-xl border p-3 ${
            envDefaultReachable ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              envDefaultReachable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {envDefaultReachable ? <CheckIcon className="h-3.5 w-3.5" /> : <WarningIcon className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${envDefaultReachable ? "text-emerald-800" : "text-amber-800"}`}>
              {settings.envDefaultProvider.name} ({settings.envDefaultProvider.baseURL})
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
              {envDefaultReachable
                ? `Erreichbar - ${envDefaultModels.length} Modell${envDefaultModels.length === 1 ? "" : "e"} gefunden.`
                : "Nicht erreichbar. Wird als Fallback verwendet, solange kein anderer Provider ausgewaehlt ist."}
            </p>
          </div>
          <RefreshButton />
        </div>

        {providerRows.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {providerRows.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{provider.name}</p>
                  <p className="mt-1 break-all text-xs text-[var(--muted)]">{provider.baseURL}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    API-Key: {provider.apiKey ? `${"*".repeat(6)}${provider.apiKey.slice(-4)}` : "-"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <ProviderFormOverlay
                      action={updateProviderAction}
                      provider={{
                        id: provider.id,
                        name: provider.name,
                        baseURL: provider.baseURL,
                        hasApiKey: !!provider.apiKey,
                      }}
                    />
                    <form action={deleteProviderAction}>
                      <input type="hidden" name="id" value={provider.id} />
                      <DeleteConfirmButton
                        triggerLabel="Loeschen"
                        title="Provider loeschen?"
                        message={`"${provider.name}" wird entfernt. Rollen, die aktuell diesen Provider verwenden, fallen automatisch auf den Server-Standard zurueck.`}
                      />
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
              <table className="min-w-full">
                <thead className="bg-[var(--surface-alt)]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Base URL</th>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">API-Key</th>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.map((provider) => (
                    <tr key={provider.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--foreground)]">{provider.name}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{provider.baseURL}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {provider.apiKey ? `${"*".repeat(6)}${provider.apiKey.slice(-4)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-3">
                          <ProviderFormOverlay
                            action={updateProviderAction}
                            provider={{
                              id: provider.id,
                              name: provider.name,
                              baseURL: provider.baseURL,
                              hasApiKey: !!provider.apiKey,
                            }}
                          />
                          <form action={deleteProviderAction}>
                            <input type="hidden" name="id" value={provider.id} />
                            <DeleteConfirmButton
                              triggerLabel="Loeschen"
                              title="Provider loeschen?"
                              message={`"${provider.name}" wird entfernt. Rollen, die aktuell diesen Provider verwenden, fallen automatisch auf den Server-Standard zurueck.`}
                            />
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {providerRows.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Noch keine zusaetzlichen Provider konfiguriert. Es wird der Server-Standard aus der .env verwendet.
          </p>
        )}
      </div>

      <form action={updateModelSettingsAction} className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
              <WandIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Primary Model (Text-Generierung)</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Wird fuer alle Text-Prompts verwendet: Artikel schreiben, Hot-Topics filtern, Autoren zuordnen,
            Zitate/Themen uebersetzen, Newsletter kuratieren.
          </p>

          <div className="mt-3">
            <ModelRoleSelector
              role="primary"
              providers={providerRows.map((p) => ({ id: p.id, name: p.name }))}
              envDefaultProviderId={ENV_DEFAULT_PROVIDER_ID}
              envDefaultLabel={`Automatisch / Server-Standard (${settings.defaultPrimaryModel})`}
              modelsByProvider={settings.modelsByProvider}
              initialProviderId={settings.primaryProviderId}
              initialModel={settings.primaryModel}
              autoModelLabel="Automatisch / Server-Standard"
              allowedTypes={["llm", "vlm"]}
            />
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            Aktuell aktiv: <span className="font-bold text-[var(--foreground)]">{settings.effectivePrimaryModel}</span>
            {!settings.primaryModel && " (Server-Standard, keine explizite Auswahl gespeichert)"}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
              <DatabaseIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Embedding Model (Duplikat-Erkennung)</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Wird fuer den semantischen Titel-Vergleich verwendet (erkennt dieselbe Meldung ueber Quellen hinweg,
            auch bei unterschiedlicher Formulierung). Kein Text-Prompt - reine Vektor-Berechnung.
          </p>

          <div className="mt-3">
            <ModelRoleSelector
              role="embedding"
              providers={providerRows.map((p) => ({ id: p.id, name: p.name }))}
              envDefaultProviderId={ENV_DEFAULT_PROVIDER_ID}
              envDefaultLabel={`Automatisch / Server-Standard (${settings.defaultEmbeddingModel})`}
              modelsByProvider={settings.modelsByProvider}
              initialProviderId={settings.embeddingProviderId}
              initialModel={settings.embeddingModel}
              autoModelLabel="Automatisch erkennen (aktuell geladenes Embedding-Modell)"
              allowedTypes={["embeddings"]}
            />
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            Aktuell aktiv: <span className="font-bold text-[var(--foreground)]">{settings.effectiveEmbeddingModel}</span>
            {settings.embeddingIsAutoDetected && " (automatisch erkannt)"}
          </p>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
        >
          Einstellungen speichern
        </button>
      </form>
    </PageContainer>
  );
}

import { revalidatePath } from "next/cache";
import PromptCard from "@/app/admin/prompts/PromptCard";
import { listPromptsForAdmin, updatePromptTemplate, resetPromptTemplate } from "@/lib/prompts";
import type { PromptCategory } from "@/lib/prompt-registry";

const CATEGORY_ORDER: PromptCategory[] = ["Artikel-Erstellung", "Recherche & Themen", "Newsletter", "Uebersetzung"];

const CATEGORY_HINT: Record<PromptCategory, string> = {
  "Artikel-Erstellung": "Schreibt die eigentlichen Artikeltexte aus Quellenmaterial und Recherche.",
  "Recherche & Themen": "Bewertet, filtert und verteilt Trend-Themen aus dem Hot-Topics-Radar.",
  Newsletter: "Stellt Newsletter-Ausgaben zusammen und schreibt die Editorial-Einleitung.",
  Uebersetzung: "Uebersetzt Recherche-Material und Themen-Metadaten ins Deutsche.",
};

export default async function PromptsPage() {
  async function updatePromptAction(formData: FormData) {
    "use server";

    const key = String(formData.get("key") || "");
    const template = String(formData.get("template") || "");
    if (!key) return;

    await updatePromptTemplate(key, template);
    revalidatePath("/admin/prompts");
  }

  async function resetPromptAction(formData: FormData) {
    "use server";

    const key = String(formData.get("key") || "");
    if (!key) return;

    await resetPromptTemplate(key);
    revalidatePath("/admin/prompts");
  }

  const prompts = await listPromptsForAdmin();
  const customizedCount = prompts.filter((p) => p.isCustomized).length;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Jeder Text, den die KI im Hintergrund an LM Studio schickt, ist hier sichtbar und editierbar - inklusive
            genauer Angabe, wofuer er da ist und bei welcher Taetigkeit er automatisch ausgefuehrt wird. Aenderungen
            wirken sofort auf den naechsten Lauf, ganz ohne Deployment.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
          <div className="text-right">
            <p className="text-lg font-extrabold leading-none text-[var(--primary-strong)]">{prompts.length}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Prompts gesamt</p>
          </div>
          <div className="mx-1 h-8 w-px bg-[var(--border)]" />
          <div className="text-right">
            <p className="text-lg font-extrabold leading-none text-indigo-600">{customizedCount}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Angepasst</p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {CATEGORY_ORDER.map((category) => {
          const items = prompts.filter((p) => p.category === category);
          if (items.length === 0) return null;

          return (
            <section key={category}>
              <div className="mb-3 flex items-baseline gap-2.5">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--primary-strong)]">{category}</h2>
                <span className="text-xs text-[var(--muted)]">{CATEGORY_HINT[category]}</span>
              </div>
              <div className="space-y-3">
                {items.map((prompt) => (
                  <PromptCard key={prompt.key} prompt={prompt} updateAction={updatePromptAction} resetAction={resetPromptAction} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

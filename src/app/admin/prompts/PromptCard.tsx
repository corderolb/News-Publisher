"use client";

import { useEffect, useRef, useState } from "react";
import DeleteConfirmButton from "@/app/admin/DeleteConfirmButton";
import { ChevronIcon, EyeIcon, MessageIcon, TagIcon, TargetIcon } from "@/app/admin/JobIcons";
import { formatRelativeTime } from "@/lib/format";
import type { PromptVariable } from "@/lib/prompt-registry";

export type PromptCardData = {
  key: string;
  label: string;
  category: string;
  description: string;
  usageContext: string;
  currentTemplate: string;
  isCustomized: boolean;
  updatedAt: Date | null;
  samplePreview: string;
  variables: PromptVariable[];
};

type PromptCardProps = {
  prompt: PromptCardData;
  updateAction: (formData: FormData) => Promise<void>;
  resetAction: (formData: FormData) => Promise<void>;
};

export default function PromptCard({ prompt, updateAction, resetAction }: PromptCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Deep-link support from the Prozesse page (/admin/prompts#article-writer):
  // open this card and scroll it into view if the URL hash names it.
  useEffect(() => {
    if (window.location.hash === `#${prompt.key}` && detailsRef.current) {
      detailsRef.current.open = true;
      detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [prompt.key]);

  return (
    <details
      ref={detailsRef}
      id={prompt.key}
      className="group scroll-mt-20 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition-all duration-200 open:shadow-md open:ring-1 open:ring-[var(--primary)]/15 hover:border-[var(--primary)]/30 hover:shadow-md"
    >
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 [&::-webkit-details-marker]:hidden sm:flex-row sm:items-start sm:gap-4 sm:p-5">
        <div className="flex items-start gap-3 sm:contents">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${
              prompt.isCustomized ? "border-indigo-200 bg-indigo-100 text-indigo-900" : "border-slate-200 bg-slate-100 text-slate-500"
            }`}
          >
            <MessageIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                {prompt.category}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                  prompt.isCustomized
                    ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${prompt.isCustomized ? "bg-indigo-500" : "bg-emerald-500"}`} />
                {prompt.isCustomized ? "Angepasst" : "Standard"}
              </span>
            </div>

            <p className="mt-1.5 text-[15px] font-bold leading-snug text-[var(--foreground)]">{prompt.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{prompt.description}</p>
            {prompt.isCustomized && prompt.updatedAt && (
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">Zuletzt angepasst {formatRelativeTime(prompt.updatedAt)}</p>
            )}
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 self-end text-[10px] font-bold uppercase tracking-wide text-[var(--muted)] transition-colors group-open:text-[var(--primary)] sm:self-start">
          Bearbeiten
          <ChevronIcon className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" />
        </span>
      </summary>

      <div className="space-y-5 border-t border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 sm:px-5">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
              <TargetIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Wann wird dieser Prompt ausgefuehrt?</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">{prompt.usageContext}</p>
        </div>

        {prompt.variables.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
                <TagIcon className="h-3.5 w-3.5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Verfuegbare Variablen</p>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Diese Platzhalter werden beim Ausfuehren automatisch durch echte Werte ersetzt. Sie koennen im Text
              beliebig oft und in beliebiger Reihenfolge verwendet werden.
            </p>
            <dl className="mt-3 space-y-2">
              {prompt.variables.map((variable) => (
                <div key={variable.token} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="shrink-0">
                    <code className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                      {`{{${variable.token}}}`}
                    </code>
                  </dt>
                  <dd className="text-xs text-[var(--muted)]">{variable.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <form action={updateAction} className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <input type="hidden" name="key" value={prompt.key} />
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-[var(--foreground)]">Prompt-Text</label>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-alt)]"
            >
              <EyeIcon className="h-3.5 w-3.5" />
              {showPreview ? "Vorschau ausblenden" : "Vorschau mit Beispieldaten"}
            </button>
          </div>

          {showPreview && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                So sieht der Prompt mit Beispielwerten aus - keine KI-Anfrage, reine Textvorschau
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
                {prompt.samplePreview}
              </pre>
            </div>
          )}

          <textarea
            name="template"
            defaultValue={prompt.currentTemplate}
            rows={18}
            spellCheck={false}
            className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              Prompt speichern
            </button>
          </div>
        </form>

        {prompt.isCustomized && (
          <form action={resetAction}>
            <input type="hidden" name="key" value={prompt.key} />
            <DeleteConfirmButton
              triggerLabel="Auf Standard zuruecksetzen"
              title="Auf Standard zuruecksetzen?"
              message={`Deine Anpassungen an "${prompt.label}" werden verworfen und durch den mitgelieferten Standard-Prompt ersetzt. Das kann nicht rueckgaengig gemacht werden.`}
              confirmLabel="Ja, zuruecksetzen"
              triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--muted)] shadow-sm transition hover:bg-rose-50"
              confirmClassName="rounded-md bg-[var(--off-fg)] px-3 py-1.5 text-sm font-semibold text-white"
            />
          </form>
        )}
      </div>
    </details>
  );
}

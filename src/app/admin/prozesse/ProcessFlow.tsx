import Link from "next/link";
import {
  ChevronIcon,
  DatabaseIcon,
  DownloadIcon,
  FilterIcon,
  ForkIcon,
  LayersIcon,
  MessageIcon,
  RepeatIcon,
  SearchIcon,
  SendIcon,
  TargetIcon,
} from "@/app/admin/JobIcons";
import { getPromptDefinition } from "@/lib/prompt-registry";
import type { ProcessDefinition, ProcessStep, ProcessStepType } from "@/lib/process-registry";

const STEP_ICON_BY_LABEL: Array<{ match: RegExp; icon: typeof SearchIcon }> = [
  { match: /laden|pool/i, icon: DatabaseIcon },
  { match: /speichern|snapshot/i, icon: DatabaseIcon },
  { match: /sammeln|discovery|recherche/i, icon: SearchIcon },
  { match: /duplikat|filter/i, icon: FilterIcon },
  { match: /volltext/i, icon: DownloadIcon },
  { match: /versand|smtp/i, icon: SendIcon },
  { match: /html rendern/i, icon: LayersIcon },
];

function iconForStep(step: ProcessStep) {
  if (step.type === "prompt") return MessageIcon;
  const hit = STEP_ICON_BY_LABEL.find((entry) => entry.match.test(step.label));
  return hit?.icon || TargetIcon;
}

const TYPE_STYLE: Record<ProcessStepType, { ring: string; bg: string; text: string; badge: string; badgeLabel: string }> = {
  prompt: {
    ring: "ring-indigo-200",
    bg: "bg-indigo-100",
    text: "text-indigo-900",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    badgeLabel: "KI-Prompt",
  },
  action: {
    ring: "ring-slate-200",
    bg: "bg-slate-100",
    text: "text-slate-700",
    badge: "bg-slate-50 text-slate-600 ring-slate-200",
    badgeLabel: "Aktion",
  },
  decision: {
    ring: "ring-amber-200",
    bg: "bg-amber-100",
    text: "text-amber-900",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    badgeLabel: "Entscheidung",
  },
};

export default function ProcessFlow({ process }: { process: ProcessDefinition }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] p-4 sm:p-5">
        <p className="text-[15px] font-bold text-[var(--foreground)]">{process.label}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{process.summary}</p>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
            <TargetIcon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Ausloeser</p>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--foreground)]">{process.trigger}</p>
          </div>
        </div>

        {process.loopHint && (
          <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <RepeatIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm leading-relaxed text-indigo-800">{process.loopHint}</p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <ol className="relative space-y-5">
          {process.steps.length > 1 && (
            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-[var(--border)]" aria-hidden />
          )}

          {process.steps.map((step, index) => {
            const Icon = iconForStep(step);
            const style = TYPE_STYLE[step.type];
            const promptDefinition = step.promptKey ? getPromptDefinition(step.promptKey) : undefined;

            return (
              <li key={`${step.label}-${index}`} className="relative flex gap-3.5">
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white ${style.ring} ${style.bg} ${style.text}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 pb-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[var(--muted)]">Schritt {index + 1}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style.badge}`}>
                      {step.type === "decision" && <ForkIcon className="h-2.5 w-2.5" />}
                      {style.badgeLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{step.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{step.description}</p>

                  {step.note && (
                    <p className="mt-1.5 rounded-lg bg-[var(--surface-alt)] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--muted)]">
                      <span className="font-bold text-[var(--foreground)]">Hinweis: </span>
                      {step.note}
                    </p>
                  )}

                  {promptDefinition && (
                    <Link
                      href={`/admin/prompts#${promptDefinition.key}`}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Prompt "{promptDefinition.label}" ansehen
                      <ChevronIcon className="h-3 w-3 -rotate-90" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

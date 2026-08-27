import ProcessFlow from "@/app/admin/prozesse/ProcessFlow";
import { PROCESS_DEFINITIONS } from "@/lib/process-registry";
import { ForkIcon, MessageIcon, TargetIcon } from "@/app/admin/JobIcons";
import PageContainer from "@/components/ui/PageContainer";

export default function ProzessePage() {
  return (
    <PageContainer>
      <div className="mb-6 max-w-2xl">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Der genaue Ablauf jedes automatisierten Prozesses im System - in welcher Reihenfolge welche Schritte
          laufen, was davon ein KI-Prompt ist und was ein rein mechanischer Schritt, und wodurch der jeweilige
          Prozess ueberhaupt ausgeloest wird.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 text-xs">
        <span className="font-bold uppercase tracking-wide text-[var(--muted)]">Legende</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700 ring-1 ring-indigo-200">
          <MessageIcon className="h-3 w-3" /> KI-Prompt (Aufruf an LM Studio, editierbar unter Prompts)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 font-bold text-slate-600 ring-1 ring-slate-200">
          <TargetIcon className="h-3 w-3" /> Aktion (mechanisch, keine KI)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700 ring-1 ring-amber-200">
          <ForkIcon className="h-3 w-3" /> Entscheidung (kann Schritt/Kandidat abbrechen oder ueberspringen)
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {PROCESS_DEFINITIONS.map((process) => (
          <ProcessFlow key={process.key} process={process} />
        ))}
      </div>
    </PageContainer>
  );
}

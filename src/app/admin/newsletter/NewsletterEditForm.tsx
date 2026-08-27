"use client";

import SectionCard from "@/app/admin/SectionCard";
import DeleteConfirmButton from "@/app/admin/DeleteConfirmButton";
import { ChevronIcon, ClockIcon, LayersIcon, PowerIcon, RepeatIcon, UserIcon } from "@/app/admin/JobIcons";
import { formatRelativeTime } from "@/lib/format";
import NewsletterPreview from "@/app/admin/newsletter/NewsletterPreview";

export type NewsletterConfigData = {
  id: string;
  name: string;
  active: boolean;
  cadence: "DAILY" | "WEEKLY" | "MONTHLY";
  sendHour: string;
  recipients: string;
  subjectTemplate: string;
  topN: number;
  lastSentAt: Date | null;
  nextSendAt: Date | null;
};

type NewsletterEditFormProps = {
  config: NewsletterConfigData;
  previewHtml: string;
  articleCount: number;
  recipientCount: number;
  updateAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  sendNowAction: (formData: FormData) => Promise<void>;
  sendTestAction: (formData: FormData) => Promise<void>;
};

const CADENCE_LABEL: Record<NewsletterConfigData["cadence"], string> = {
  DAILY: "Taeglich",
  WEEKLY: "Woechentlich",
  MONTHLY: "Monatlich",
};
const CADENCE_TONE: Record<NewsletterConfigData["cadence"], string> = {
  DAILY: "bg-blue-50 text-blue-700 ring-blue-200",
  WEEKLY: "bg-purple-50 text-purple-700 ring-purple-200",
  MONTHLY: "bg-teal-50 text-teal-700 ring-teal-200",
};
const CADENCE_PERIOD_HINT: Record<NewsletterConfigData["cadence"], string> = {
  DAILY: "letzte 24 Std.",
  WEEKLY: "letzte 7 Tage",
  MONTHLY: "letzte 30 Tage",
};

function Pill({ children, className, title }: { children: React.ReactNode; className: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${className}`}>
      {children}
    </span>
  );
}

export default function NewsletterEditForm({
  config,
  previewHtml,
  articleCount,
  recipientCount,
  updateAction,
  toggleAction,
  deleteAction,
  sendNowAction,
  sendTestAction,
}: NewsletterEditFormProps) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition-all duration-200 open:shadow-md open:ring-1 open:ring-[var(--primary)]/15 hover:border-[var(--primary)]/30 hover:shadow-md">
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 [&::-webkit-details-marker]:hidden sm:flex-row sm:items-start sm:gap-4 sm:p-5">
        <div className="flex items-start gap-3 sm:contents">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${
              config.active ? "border-emerald-200 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-slate-100 text-slate-500"
            }`}
          >
            <RepeatIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill className={CADENCE_TONE[config.cadence]}>{CADENCE_LABEL[config.cadence]}</Pill>
              <Pill className={config.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
                <span className={`h-1.5 w-1.5 rounded-full ${config.active ? "bg-emerald-500" : "bg-rose-400"}`} />
                {config.active ? "Aktiv" : "Inaktiv"}
              </Pill>
              <Pill className="bg-indigo-50 text-indigo-700 ring-indigo-200" title="Beim Versand waehlt und ordnet die KI die Artikel und schreibt eine Editorial-Einleitung">
                KI waehlt beim Versand
              </Pill>
            </div>

            <p className="mt-1.5 text-[15px] font-bold leading-snug text-[var(--foreground)]">{config.name}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1" title="Empfaenger">
                <UserIcon className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                <span className="font-semibold tabular-nums text-[var(--foreground)]">{recipientCount}</span>
                Empfaenger
              </span>
              <span className="inline-flex items-center gap-1" title="Artikel im aktuellen Zeitraum">
                <LayersIcon className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                <span className="font-semibold tabular-nums text-[var(--foreground)]">{articleCount}</span>
                Artikel ({CADENCE_PERIOD_HINT[config.cadence]})
              </span>
              <span className="inline-flex items-center gap-1" title={config.nextSendAt ? new Date(config.nextSendAt).toLocaleString() : undefined}>
                <ClockIcon className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                Naechster Versand: {config.nextSendAt ? formatRelativeTime(config.nextSendAt) : "-"}
              </span>
            </div>
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 self-end text-[10px] font-bold uppercase tracking-wide text-[var(--muted)] transition-colors group-open:text-[var(--primary)] sm:self-start">
          Details
          <ChevronIcon className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" />
        </span>
      </summary>

      <div className="space-y-5 border-t border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={config.id} />
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-alt)]">
              <PowerIcon className="h-3.5 w-3.5" />
              {config.active ? "Deaktivieren" : "Aktivieren"}
            </button>
          </form>

          <form action={deleteAction}>
            <input type="hidden" name="id" value={config.id} />
            <DeleteConfirmButton
              triggerLabel="Loeschen"
              message={`Moechtest du den Newsletter "${config.name}" wirklich loeschen?`}
              triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--off-fg)] shadow-sm transition hover:bg-rose-50"
              confirmClassName="rounded-md bg-[var(--off-fg)] px-3 py-1.5 text-sm font-semibold text-white"
            />
          </form>

          <form action={sendNowAction}>
            <input type="hidden" name="id" value={config.id} />
            <button type="submit" className="ml-auto rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
              Jetzt an Empfaenger senden
            </button>
          </form>

          <form action={sendTestAction} className="flex min-w-0 items-center gap-2">
            <input type="hidden" name="id" value={config.id} />
            <input
              name="testEmail"
              type="email"
              required
              placeholder="test@example.com"
              className="min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
            <button type="submit" className="shrink-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-alt)]">
              Test-Mail
            </button>
          </form>
        </div>

        <form action={updateAction} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <input type="hidden" name="id" value={config.id} />

          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Name</label>
            <input
              name="name"
              required
              defaultValue={config.name}
              className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </div>

          <SectionCard icon={<RepeatIcon className="h-3.5 w-3.5" />} title="Zeitplan">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Frequenz</label>
                <select
                  name="cadence"
                  defaultValue={config.cadence}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                >
                  <option value="DAILY">Taeglich</option>
                  <option value="WEEKLY">Woechentlich (letzte 7 Tage)</option>
                  <option value="MONTHLY">Monatlich (letzte 30 Tage)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Sendezeit</label>
                <input
                  name="sendHour"
                  type="time"
                  defaultValue={config.sendHour}
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <input name="active" type="checkbox" defaultChecked={config.active} className="h-4 w-4" />
                  Digest aktiv
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<LayersIcon className="h-3.5 w-3.5" />} title="Inhalt">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Betreff</label>
                <input
                  name="subjectTemplate"
                  defaultValue={config.subjectTemplate}
                  required
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Top-Artikel</label>
                <input
                  name="topN"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={config.topN}
                  className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2 sm:w-24"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<UserIcon className="h-3.5 w-3.5" />}
            title="Empfaenger"
            action={<span className="text-[10px] font-semibold text-[var(--muted)]">{recipientCount} aktuell</span>}
          >
            <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">
              E-Mail-Adressen <span className="font-normal text-[var(--muted)]">(kommagetrennt oder eine pro Zeile)</span>
            </label>
            <textarea
              name="recipients"
              defaultValue={config.recipients}
              rows={3}
              placeholder="redaktion@spielfilm.de, marketing@spielfilm.de"
              className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </SectionCard>

          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
          >
            Newsletter speichern
          </button>
        </form>

        <NewsletterPreview html={previewHtml} articleCount={articleCount} />
      </div>
    </details>
  );
}

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { RepeatIcon, LayersIcon, WarningIcon, TargetIcon, PowerIcon, ClockIcon, UserIcon } from "@/app/admin/JobIcons";
import { formatRelativeTime } from "@/lib/format";

async function getOrCreateSettings() {
  const existing = await prisma.radarSettings.findFirst();
  if (existing) return existing;
  return prisma.radarSettings.create({ data: {} });
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "< 1 Min.";
  if (minutes < 60) return `~${minutes} Min.`;
  return `~${(minutes / 60).toFixed(1)} Std.`;
}

const STATUS_LABEL: Record<string, string> = {
  WRITING: "Wird gerade geschrieben",
  ASSIGNED: "Autor zugeordnet, wartet auf Reihe",
  SCORED: "Bewertet, wartet auf Autor-Zuordnung",
  DISCOVERED: "Entdeckt, wartet auf Bewertung",
};

const STATUS_TONE: Record<string, string> = {
  WRITING: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  ASSIGNED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SCORED: "bg-amber-50 text-amber-700 ring-amber-200",
  DISCOVERED: "bg-slate-50 text-slate-600 ring-slate-200",
};

export default async function RadarSettingsPage() {
  async function updateSettingsAction(formData: FormData) {
    "use server";

    const active = formData.get("active") === "on";
    const publishDirectly = formData.get("publishDirectly") === "on";
    const scanIntervalMinutes = Math.max(1, Number(formData.get("scanIntervalMinutes")) || 15);
    const dailyArticleLimit = Math.max(1, Number(formData.get("dailyArticleLimit")) || 20);
    const minScore = Math.max(0, Math.min(100, Number(formData.get("minScore")) || 0));

    const existing = await prisma.radarSettings.findFirst();
    const data = { active, publishDirectly, scanIntervalMinutes, dailyArticleLimit, minScore };

    if (existing) {
      await prisma.radarSettings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.radarSettings.create({ data });
    }

    revalidatePath("/admin/radar");
  }

  async function resetCircuitBreakerAction() {
    "use server";

    const existing = await prisma.radarSettings.findFirst();
    if (existing) {
      await prisma.radarSettings.update({ where: { id: existing.id }, data: { consecutiveFailures: 0 } });
    }

    revalidatePath("/admin/radar");
  }

  const [settings, backlogCounts, todaysWritten, recentDurations, writing, assigned, scored, discovered] = await Promise.all([
    getOrCreateSettings(),
    prisma.radarQueueItem.groupBy({ by: ["status"], _count: true }),
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return prisma.radarQueueItem.count({ where: { status: "DONE", writtenAt: { gte: todayStart } } });
    })(),
    prisma.jobRun.findMany({
      where: { status: "COMPLETED", mode: { in: ["radar-publish", "radar-review"] }, durationMs: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 20,
      select: { durationMs: true },
    }),
    prisma.radarQueueItem.findMany({ where: { status: "WRITING" }, include: { author: true, source: true } }),
    prisma.radarQueueItem.findMany({
      where: { status: "ASSIGNED" },
      orderBy: { score: "desc" },
      include: { author: true, source: true },
      take: 30,
    }),
    prisma.radarQueueItem.findMany({
      where: { status: "SCORED" },
      orderBy: { score: "desc" },
      include: { source: true },
      take: 15,
    }),
    prisma.radarQueueItem.findMany({
      where: { status: "DISCOVERED" },
      orderBy: { discoveredAt: "asc" },
      include: { source: true },
      take: 15,
    }),
  ]);

  const backlog: Record<string, number> = { DISCOVERED: 0, SCORED: 0, ASSIGNED: 0, WRITING: 0, DONE: 0, SKIPPED: 0, FAILED: 0 };
  for (const row of backlogCounts) backlog[row.status] = row._count;

  const circuitBreakerTripped = settings.consecutiveFailures >= 3;

  const avgDurationMs =
    recentDurations.length > 0
      ? Math.round(recentDurations.reduce((sum, r) => sum + (r.durationMs || 0), 0) / recentDurations.length)
      : null;

  const queueRows = [
    ...writing.map((item) => ({ item, status: "WRITING" as const })),
    ...assigned.map((item) => ({ item, status: "ASSIGNED" as const })),
    ...scored.map((item) => ({ item, status: "SCORED" as const })),
    ...discovered.map((item) => ({ item, status: "DISCOVERED" as const })),
  ];

  let assignedIndex = 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 max-w-2xl">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Der News Radar scannt alle aktiven Quellen automatisch, bewertet neue Kandidaten, ordnet sie einem
          passenden Autor zu und schreibt sie nacheinander ab - statt eines festen Kampagnen-Zeitplans mit einem
          fixen Autor pro Lauf.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5 text-center">
          <p className="text-xl font-extrabold text-[var(--primary-strong)]">{backlog.DISCOVERED}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Entdeckt</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5 text-center">
          <p className="text-xl font-extrabold text-[var(--primary-strong)]">{backlog.SCORED}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Bewertet</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5 text-center">
          <p className="text-xl font-extrabold text-[var(--primary-strong)]">{backlog.ASSIGNED}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Zugeordnet</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5 text-center">
          <p className="text-xl font-extrabold text-emerald-600">{todaysWritten}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Heute geschrieben</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5 text-center">
          <p className="text-xl font-extrabold text-[var(--primary-strong)]">{avgDurationMs ? formatDuration(avgDurationMs) : "-"}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Ø Dauer/Artikel</p>
        </div>
      </div>

      {circuitBreakerTripped && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <WarningIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-rose-800">
              Sicherheitsabbruch aktiv - {settings.consecutiveFailures} fehlgeschlagene Generierungen in Folge
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Der Radar reiht so lange keine neuen Artikel mehr ein, bis LM Studio wieder zuverlaessig antwortet.
              Ein manueller Requeue (Jobs-Liste) der als "erneut versuchen" markiert ist, setzt den Zaehler bei
              Erfolg automatisch zurueck - oder hier manuell zuruecksetzen, wenn du sicher bist, dass LM Studio
              wieder laeuft.
            </p>
            <form action={resetCircuitBreakerAction} className="mt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-100"
              >
                <PowerIcon className="h-3.5 w-3.5" />
                Zaehler zuruecksetzen
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Warteschlange</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Wer an was arbeitet, in welcher Reihenfolge - "Zugeordnet" ist bereits die tatsaechliche Schreib-Reihenfolge
            (hoechster Score zuerst).
            {avgDurationMs && " Voraussichtliche Zeit basiert auf dem Durchschnitt der letzten 20 fertigen Artikel."}
          </p>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          <ul className="divide-y divide-[var(--border)]">
            {queueRows.map(({ item, status }) => {
              let eta: string | null = null;
              if (status === "ASSIGNED") {
                eta = avgDurationMs ? formatDuration(avgDurationMs * (assignedIndex + 1)) : null;
                assignedIndex++;
              }

              const author = "author" in item ? item.author : null;

              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${STATUS_TONE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                    <p className="text-xs text-[var(--muted)]">{item.source.name}</p>
                  </div>
                  {typeof item.score === "number" && (
                    <span className="shrink-0 text-xs font-bold text-[var(--foreground)]">{item.score}/100</span>
                  )}
                  {author && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--muted)]" title={item.authorReason || undefined}>
                      <UserIcon className="h-3 w-3" />
                      {author.name}
                    </span>
                  )}
                  {eta && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)]" title="Voraussichtliche Zeit bis dieser Artikel fertig ist">
                      <ClockIcon className="h-3 w-3" />
                      {eta}
                    </span>
                  )}
                </li>
              );
            })}
            {queueRows.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">Warteschlange ist leer.</li>
            )}
          </ul>
        </div>
      </div>

      <form action={updateSettingsAction} className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
              <RepeatIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Scan-Zeitplan</p>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Scan-Intervall (Minuten)</label>
              <input
                name="scanIntervalMinutes"
                type="number"
                min={1}
                defaultValue={settings.scanIntervalMinutes}
                className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input name="active" type="checkbox" defaultChecked={settings.active} className="h-4 w-4" />
                Radar aktiv
              </label>
            </div>
          </div>
          {settings.lastScanAt && (
            <p className="mt-2 text-xs text-[var(--muted)]">Letzter Scan: {formatRelativeTime(settings.lastScanAt)}</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
              <LayersIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Ausgabe-Limit</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Begrenzt, wie viele Artikel der Radar pro Kalendertag insgesamt schreibt - unabhaengig davon, wie viele
            Kandidaten gefunden und positiv bewertet werden.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Artikel pro Tag</label>
              <input
                name="dailyArticleLimit"
                type="number"
                min={1}
                defaultValue={settings.dailyArticleLimit}
                className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <input name="publishDirectly" type="checkbox" defaultChecked={settings.publishDirectly} className="h-4 w-4" />
                Direkt veroeffentlichen (statt Review)
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary-strong)]">
              <TargetIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Mindest-Score</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Kandidaten unter diesem Prioritaets-Score (0-100, von der KI vergeben) werden uebersprungen statt
            geschrieben. 0 = alles wird versucht.
          </p>
          <input
            name="minScore"
            type="number"
            min={0}
            max={100}
            defaultValue={settings.minScore}
            className="mt-3 block w-32 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
        >
          Einstellungen speichern
        </button>
      </form>
    </div>
  );
}

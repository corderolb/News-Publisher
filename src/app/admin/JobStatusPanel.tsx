"use client";

import { useEffect, useMemo, useState } from "react";

type JobEvent = {
  id: string;
  step: string;
  message: string;
  createdAt: string;
};

type RadarItemRef = { id: string; title: string } | null;

type JobRunDetail = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  mode: string;
  topic: string | null;
  radarItem?: RadarItemRef;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  totalItems: number;
  processed: number;
  failed: number;
  message: string | null;
  durationMs: number | null;
  events: JobEvent[];
};

type JobRunSummary = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  mode: string;
  topic: string | null;
  createdAt: string;
  finishedAt: string | null;
  startedAt: string | null;
  currentStep: string | null;
  totalItems: number;
  processed: number;
  failed: number;
  radarItem?: RadarItemRef;
};

type RadarStatus = {
  active: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
  dailyArticleLimit: number;
  writtenToday: number;
  backlog: { discovered: number; scored: number; assigned: number; writing: number };
};

type StatusFilter = "ALL" | "RUNNING" | "DONE" | "FAILED";

function formatDateTime(ts?: string | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function formatRelativeMinutes(ts?: string | null) {
  if (!ts) return "-";
  const diffMs = new Date(ts).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  if (minutes <= 0) return "jetzt";
  return `${minutes} Min.`;
}

function RequeueIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export default function JobStatusPanel() {
  const [radarStatus, setRadarStatus] = useState<RadarStatus | null>(null);
  const [jobRuns, setJobRuns] = useState<JobRunSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobRunDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("RUNNING");
  const [error, setError] = useState<string | null>(null);
  const [runningNow, setRunningNow] = useState(false);
  const [requeuingId, setRequeuingId] = useState<string | null>(null);

  const hasRunningJobs = jobRuns.some((item) => item.status === "RUNNING" || item.status === "QUEUED");

  async function loadOverview() {
    try {
      const res = await fetch("/api/jobs/overview", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Job-Overview konnte nicht geladen werden");

      setRadarStatus(data.radar || null);
      setJobRuns(Array.isArray(data.jobRuns) ? data.jobRuns : []);

      setError(null);
    } catch (err: any) {
      setError(err?.message || "Job-Overview konnte nicht geladen werden");
    }
  }

  async function loadJobDetail(jobRunId: string) {
    try {
      const res = await fetch(`/api/jobs/status?jobRunId=${jobRunId}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Job-Details konnten nicht geladen werden");
      setSelectedJob(data.job || null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Job-Details konnten nicht geladen werden");
      setSelectedJob(null);
    }
  }

  async function runRadarNow() {
    try {
      setRunningNow(true);
      setError(null);

      const res = await fetch("/api/jobs/start", { method: "POST" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Radar konnte nicht gestartet werden");

      await loadOverview();
    } catch (err: any) {
      setError(err?.message || "Radar konnte nicht gestartet werden");
    } finally {
      setRunningNow(false);
    }
  }

  async function requeueJob(jobRunId: string) {
    try {
      setRequeuingId(jobRunId);
      setError(null);

      const res = await fetch("/api/jobs/requeue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobRunId }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Job konnte nicht erneut eingereiht werden");

      await loadOverview();
      if (data.jobRunId) {
        setSelectedJobId(String(data.jobRunId));
      }
    } catch (err) {
      setError((err as Error)?.message || "Job konnte nicht erneut eingereiht werden");
    } finally {
      setRequeuingId(null);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadOverview();
    }, hasRunningJobs ? 2000 : 15000);

    return () => clearInterval(timer);
  }, [hasRunningJobs]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      return;
    }
    loadJobDetail(selectedJobId);
  }, [selectedJobId]);

  const filteredJobRuns = useMemo(() => {
    if (statusFilter === "RUNNING") {
      return jobRuns.filter((run) => run.status === "RUNNING" || run.status === "QUEUED");
    }

    if (statusFilter === "DONE") {
      return jobRuns.filter((run) => run.status === "COMPLETED");
    }

    if (statusFilter === "FAILED") {
      return jobRuns.filter((run) => run.status === "FAILED");
    }

    return jobRuns;
  }, [jobRuns, statusFilter]);

  function stepText(run: JobRunSummary) {
    if (run.totalItems > 0) {
      const done = Math.max(0, Math.min(run.totalItems, run.processed));
      return `${done}/${run.totalItems}`;
    }
    return run.currentStep || "-";
  }

  function jobLabel(run: { radarItem?: RadarItemRef; topic: string | null; mode?: string }) {
    if (run.mode === "radar-scoring") return "Radar: Bewertung & Autor-Zuordnung";
    return run.radarItem?.title || run.topic || "Ad-hoc Job";
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Job Status</p>
        <h2 className="mt-1 text-xl font-extrabold text-[var(--primary-strong)]">Pipeline Uebersicht</h2>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          <span>News Radar</span>
          <button
            type="button"
            onClick={runRadarNow}
            disabled={runningNow}
            title="Radar sofort ausfuehren"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-1 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningNow ? (
              <span className="block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            Jetzt ausfuehren
          </button>
        </div>
        <div className="px-3 py-2.5 text-sm">
          {radarStatus ? (
            <>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${radarStatus.active ? "bg-emerald-500" : "bg-rose-400"}`} />
                  {radarStatus.active ? "Aktiv" : "Pausiert"}
                </span>
                <span className="text-[var(--muted)]">Naechster Scan in {formatRelativeMinutes(radarStatus.nextScanAt)}</span>
                <span className="text-[var(--muted)]">
                  Heute geschrieben: <span className="font-semibold text-[var(--foreground)]">{radarStatus.writtenToday}</span>/{radarStatus.dailyArticleLimit}
                </span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Backlog: {radarStatus.backlog.discovered} entdeckt · {radarStatus.backlog.scored} bewertet · {radarStatus.backlog.assigned} zugeordnet · {radarStatus.backlog.writing} in Arbeit
              </p>
            </>
          ) : (
            <p className="text-[var(--muted)]">Lade Radar-Status...</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Jobliste</p>
          <div className="flex flex-wrap gap-1 text-xs">
            {([
              ["ALL", "Alle"],
              ["RUNNING", "Running"],
              ["DONE", "Done"],
              ["FAILED", "Failed"],
            ] as Array<[StatusFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-md px-2 py-1 font-semibold ${
                  statusFilter === value
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-[var(--border)]">
          {filteredJobRuns.map((run) => {
            const canRequeue = (run.status === "FAILED" || run.status === "COMPLETED") && Boolean(run.radarItem?.id);
            return (
              <li key={run.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setSelectedJobId(run.id)}
                  className={`min-w-0 flex-1 border-l-4 px-3 py-2 text-left text-sm transition ${
                    selectedJobId === run.id ? "border-l-[var(--primary)] bg-[var(--surface-alt)]" : "border-l-transparent hover:bg-[var(--surface-alt)]/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{jobLabel(run)}</p>
                    <span className="text-xs text-[var(--muted)]">{run.status}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Schritt: {stepText(run)}</p>
                </button>
                {canRequeue && (
                  <button
                    type="button"
                    onClick={() => requeueJob(run.id)}
                    disabled={requeuingId === run.id}
                    title="Erneut an den Anfang der Warteschlange stellen"
                    className="shrink-0 self-center px-2.5 text-[var(--muted)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requeuingId === run.id ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <RequeueIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
          {filteredJobRuns.length === 0 && (
            <li className="px-3 py-4 text-sm text-[var(--muted)]">Keine Jobs im gewaehlten Filter.</li>
          )}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          Details
        </div>
        {!selectedJob && (
          <p className="px-3 py-4 text-sm text-[var(--muted)]">Klicke auf einen Job in der Liste, um Details zu sehen.</p>
        )}

        {selectedJob && (
          <div className="space-y-2 px-3 py-3 text-xs text-[var(--muted)]">
            <p>Status: <span className="font-semibold text-[var(--foreground)]">{selectedJob.status}</span></p>
            <p>Job-ID: <span className="font-semibold text-[var(--foreground)]">{selectedJob.id}</span></p>
            <p>Thema: <span className="font-semibold text-[var(--foreground)]">{jobLabel(selectedJob)}</span></p>
            <p>Start: <span className="font-semibold text-[var(--foreground)]">{formatDateTime(selectedJob.startedAt)}</span></p>
            <p>Ende: <span className="font-semibold text-[var(--foreground)]">{formatDateTime(selectedJob.finishedAt)}</span></p>
            <p>Schritt: <span className="font-semibold text-[var(--foreground)]">{selectedJob.currentStep || "-"}</span></p>
            <p>Items: <span className="font-semibold text-[var(--foreground)]">{selectedJob.processed}/{selectedJob.totalItems}</span></p>
            <p>Fehler: <span className="font-semibold text-[var(--foreground)]">{selectedJob.failed}</span></p>
            {selectedJob.message && (
              <p className="rounded-lg bg-[var(--surface-alt)] px-2 py-1 text-[var(--foreground)]">{selectedJob.message}</p>
            )}

            {(selectedJob.status === "FAILED" || selectedJob.status === "COMPLETED") && selectedJob.radarItem?.id && (
              <button
                type="button"
                onClick={() => requeueJob(selectedJob.id)}
                disabled={requeuingId === selectedJob.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requeuingId === selectedJob.id ? (
                  <span className="block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <RequeueIcon className="h-3.5 w-3.5" />
                )}
                Erneut an den Anfang der Warteschlange stellen
              </button>
            )}

            {selectedJob.events.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]">
                <ul className="divide-y divide-[var(--border)]">
                  {selectedJob.events.map((event) => (
                    <li key={event.id} className="px-2 py-1.5">
                      <p className="font-semibold text-[var(--foreground)]">{event.step}</p>
                      <p>{event.message}</p>
                      <p>{formatDateTime(event.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}
    </div>
  );
}

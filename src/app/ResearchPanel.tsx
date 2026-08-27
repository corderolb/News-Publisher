"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatRelativeTime } from "@/lib/format";

type SourceMixEntry = {
  id: string;
  name: string;
  count: number;
  weight: number;
};

type IconProps = { className?: string };

function TrendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}

function FireIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13 2c.6 3.9-1.5 5.6-2.9 7-1.7 1.6-3.1 3.3-3.1 5.9C7 18.4 10.1 21 14 21c3.9 0 7-2.6 7-6.1 0-3.5-2.7-4.9-4-6.9-.5-.7-.8-1.5-1-2.4-.7 1.1-1.6 2-2 3-.7-1.3-1.1-3.5-1-6.6z" />
    </svg>
  );
}

function SparklesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M19 14l.9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6z" />
      <path d="M5 15l.8 2L8 17.8 6 18.6 5 21l-.8-2.4L2 17.8 4.2 17z" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1A4 4 0 0 1 16 11" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Trend/relevance scores are the first thing a scanning eye should be able to
// triage on - color communicates "hot" vs "lukewarm" faster than the raw
// number alone.
function scoreTone(value: number) {
  if (value >= 75) return { text: "text-emerald-700", stroke: "stroke-emerald-500", track: "stroke-emerald-100", bar: "bg-emerald-500" };
  if (value >= 50) return { text: "text-amber-700", stroke: "stroke-amber-500", track: "stroke-amber-100", bar: "bg-amber-500" };
  return { text: "text-rose-700", stroke: "stroke-rose-500", track: "stroke-rose-100", bar: "bg-rose-500" };
}

// Compact ring gauge for the trend score: a filled arc reads faster than a
// bare number, and takes up less visual weight than the old solid tile.
function TrendRing({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const tone = scoreTone(safe);
  const size = 52;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Trend Score: ${safe}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className={tone.track} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${tone.stroke} transition-[stroke-dashoffset] duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <TrendIcon className={`h-2.5 w-2.5 ${tone.text}`} />
        <span className={`text-base font-extrabold leading-none tabular-nums ${tone.text}`}>{safe}</span>
      </div>
    </div>
  );
}

const CATEGORY_TONE: Record<string, string> = {
  "Casting & Announcement": "bg-blue-50 text-blue-700 ring-blue-200",
  "Season Renewal / Cancellation": "bg-purple-50 text-purple-700 ring-purple-200",
  "Personal / Lifestyle": "bg-pink-50 text-pink-700 ring-pink-200",
  "Controversy / Scandal": "bg-rose-50 text-rose-700 ring-rose-200",
  "General News / Reviews": "bg-teal-50 text-teal-700 ring-teal-200",
  Other: "bg-slate-100 text-slate-700 ring-slate-200",
};

function categoryTone(category: string): string {
  return CATEGORY_TONE[category] || CATEGORY_TONE.Other;
}

// Metric descriptions are rendered in a portal (not a plain CSS-hover popover)
// so they can never be clipped by a card's `overflow-hidden` corner-rounding,
// regardless of where the card sits in the list or how close to the edge.
function MetricInfo({ label, title, description }: { label: string; title: string; description: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.top - 8, left: Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140) });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-20 shrink-0 cursor-help whitespace-nowrap border-b border-dotted border-[var(--muted)]/50 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] outline-none"
      >
        {label}
      </span>
      {open && coords &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-72 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900 p-3 shadow-2xl"
            style={{ top: coords.top, left: coords.left }}
          >
            <p className="text-[11px] font-bold text-white">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{description}</p>
            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-slate-900" />
          </div>,
          document.body
        )}
    </>
  );
}

const METRIC_INFO: Record<string, { title: string; description: string }> = {
  Trend: {
    title: "Trend-Score",
    description:
      "Gewichteter Gesamtwert aus den anderen vier Kennzahlen: 35% Velocity, 25% Freshness, 25% Autorität, 15% Engagement. Fasst zusammen, wie stark ein Thema gerade insgesamt performt, und bestimmt die Sortierung der Liste.",
  },
  "KI-Rel.": {
    title: "KI-Relevanz",
    description:
      "Einschätzung des Sprachmodells (0–100), wie gut das Thema zu den gewählten Fokus-Themen und dem Ziel-Themenbereich passt. Nur Themen ab 65 Punkten werden von der KI in die Liste aufgenommen, alles darunter wird automatisch aussortiert.",
  },
  Velocity: {
    title: "Velocity",
    description:
      "Wie viele unabhängige Quellen aus dem aktiven Preset (z. B. Variety, Deadline, Reddit) das Thema gerade gleichzeitig aufgreifen. Jede zusätzliche Quelle bringt +25 Punkte – ab 4 gleichzeitig berichtenden Quellen ist der Maximalwert 100 erreicht.",
  },
  Freshness: {
    title: "Freshness",
    description:
      "Wie aktuell die neueste gefundene Meldung zu diesem Thema ist. Der Wert startet bei 100 im Moment der Veröffentlichung und sinkt danach pro Stunde um 3 Punkte – nach rund 33 Stunden ist er auf 0 abgeklungen.",
  },
  Engagement: {
    title: "Engagement",
    description:
      "Durchschnittliches Interaktionssignal der Quellen, z. B. Upvotes und Kommentarzahl bei Reddit-Posts. Quellen ohne eigenes Interaktionssignal (RSS-Feeds, Google Trends, TVMaze) fließen mit einem neutralen Basiswert ein, statt den Score zu verzerren.",
  },
  Autorität: {
    title: "Autorität (Source-Weight)",
    description:
      "Durchschnittliche redaktionelle Gewichtung der beteiligten Quellen, wie sie im Quellen-Preset hinterlegt ist (z. B. Variety oder Deadline hoch gewichtet, TMZ niedriger). Spiegelt wider, wie etabliert und vertrauenswürdig die berichtenden Outlets eingeschätzt werden.",
  },
};

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: (props: IconProps) => React.ReactElement }) {
  const safe = Math.max(0, Math.min(100, value ?? 0));
  const tone = scoreTone(safe);
  const info = METRIC_INFO[label];
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--primary-strong)]" />
      {info ? (
        <MetricInfo label={label} title={info.title} description={info.description} />
      ) : (
        <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      )}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
        <div className={`h-full rounded-full ${tone.bar} transition-all`} style={{ width: `${safe}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] font-semibold tabular-nums text-[var(--foreground)]">{safe}/100</span>
    </div>
  );
}

type Topic = {
  key: string;
  title: string;
  titleDe?: string;
  url: string;
  trendScore: number;
  velocityScore: number;
  freshnessScore: number;
  engagementScore: number;
  sourceWeightScore: number;
  aiRelevance: number;
  aiReason: string;
  reasonDe?: string;
  matchedThemes: string[];
  category: string;
  entities: {
    persons: string[];
    works: string[];
    studios: string[];
  };
  sourceCount: number;
  sources: string[];
  sourceMix: SourceMixEntry[];
  publishedAt: string;
  suggestedAuthor: {
    id: string;
    name: string;
    reason: string;
  } | null;
  duplicate?: {
    id: string;
    kind: "article" | "job";
    matchType: "url" | "title" | "semantic";
    title: string;
    slug?: string;
    status?: string;
    score: number;
  } | null;
};

type SnapshotMeta = {
  id: string;
  generatedAt: string;
  focusThemes: string[];
  primaryDomain: string;
  usedAI: boolean;
  aiIncluded: number;
  aiRejected: number;
  inputTopics: number;
  fallbackReason: string | null;
  topicCount: number;
};

const PRESETS: Array<{ value: string; label: string }> = [
  { value: "entertainment", label: "Film & Serien & Promi" },
  { value: "general", label: "Allgemeine News" },
];

const PAGE_SIZE = 10;
const SNAPSHOT_PAGE_SIZE = 20;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function ResearchPanel() {
  const storageKey = "research-topics-last-result-v2";
  const [topics, setTopics] = useState<Topic[]>([]);
  const [focusThemes, setFocusThemes] = useState("casting,staffel,scandal,box-office,serie,film");
  const [preset, setPreset] = useState<string>("entertainment");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<null | {
    usedAI: boolean;
    aiDurationMs: number | null;
    aiIncluded: number;
    aiRejected: number;
    aiError: string | null;
    fallbackReason: string | null;
    inputTopics: number;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [dispatchingKey, setDispatchingKey] = useState<string | null>(null);
  // Optimistic local flag so the button flips to "already commissioned"
  // right after a successful dispatch, without waiting for the next poll
  // to pick up the resulting JobRun/Article from the server.
  const [dispatchedKeys, setDispatchedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publish, setPublish] = useState(false);
  const [inflightRunning, setInflightRunning] = useState(false);
  const [inflightStartedAt, setInflightStartedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [page, setPage] = useState(0);

  // Snapshot-Historie: null = aktuellster/Live-Snapshot, sonst wird ein
  // konkreter historischer Snapshot angezeigt (Live-Polling greift dann nicht).
  const [snapshotList, setSnapshotList] = useState<SnapshotMeta[]>([]);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const [viewingSnapshotId, setViewingSnapshotId] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  type ActiveRun = {
    cacheKey: string;
    preset: string;
    focusThemes: string[];
    startedAt: string;
    runtimeMs: number;
  };
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);

  useEffect(() => {
    const shouldTick = inflightRunning || activeRuns.length > 0;
    if (!shouldTick) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [inflightRunning, activeRuns.length]);

  function formatDurationSince(iso: string | null): string {
    if (!iso) return "-";
    const diffMs = Date.now() - new Date(iso).getTime();
    if (diffMs < 0) return "-";
    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
  }

  async function pollUpdate() {
    try {
      const params = new URLSearchParams();
      if (focusThemes.trim()) params.set("focus", focusThemes.trim());
      if (preset.trim()) params.set("preset", preset.trim());
      params.set("loadOnly", "1");

      const res = await fetch(`/api/research/topics?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) return;

      const newGeneratedAt = typeof data.generatedAt === "string" ? data.generatedAt : null;
      const inflight = Boolean(data.inflight);
      const startedAt = typeof data.inflightStartedAt === "string" ? data.inflightStartedAt : null;

      setInflightRunning(inflight);
      setInflightStartedAt(inflight ? startedAt : null);

      // While the user is browsing an older snapshot, live polling must not
      // clobber what's on screen.
      const arrivedNew =
        viewingSnapshotId === null &&
        Array.isArray(data.topics) &&
        data.topics.length > 0 &&
        newGeneratedAt &&
        newGeneratedAt !== lastUpdatedAt;
      if (arrivedNew) {
        setTopics(data.topics);
        setLastUpdatedAt(newGeneratedAt);
        setAiInfo(data.ai || null);

        if (Array.isArray(data.focusThemes) && data.focusThemes.length > 0) {
          setFocusThemes(data.focusThemes.join(","));
        }
        if (typeof data.preset === "string" && data.preset) setPreset(data.preset);

        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              topics: data.topics,
              focusThemes: Array.isArray(data.focusThemes) ? data.focusThemes : [],
              preset: typeof data.preset === "string" ? data.preset : preset,
              savedAt: newGeneratedAt,
            })
          );
        } catch {
          // Ignore storage errors.
        }

        if (!inflight) {
          setNotice("KI-Ergebnis eingetroffen.");
        }
      }
    } catch {
      // Silent poll error; try again on next tick.
    }
  }

  useEffect(() => {
    if (!inflightRunning) return;
    const interval = setInterval(() => {
      pollUpdate();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inflightRunning, focusThemes, preset, lastUpdatedAt, viewingSnapshotId]);

  // Global live status polling for every tab/user, independent of whether
  // the current tab has an active local run. This is the shared "Live-Status"
  // that shows up on Tab 2 while Tab 1 (or any other user) is computing.
  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/research/status", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!data?.ok) return;
        setActiveRuns(Array.isArray(data.runs) ? data.runs : []);
      } catch {
        // Ignore transient errors; next tick tries again.
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Passive snapshot refresh every 30s so users on other tabs pick up new
  // results published by whoever started the compute, without any click.
  useEffect(() => {
    const interval = setInterval(() => {
      pollUpdate();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusThemes, preset, lastUpdatedAt, viewingSnapshotId]);

  async function startBackgroundCompute() {
    setError(null);
    setNotice("KI-Filter laeuft im Hintergrund. Du kannst weiterarbeiten und spaeter zurueckkommen.");
    setInflightRunning(true);

    const params = new URLSearchParams();
    if (focusThemes.trim()) params.set("focus", focusThemes.trim());
    if (preset.trim()) params.set("preset", preset.trim());
    params.set("refresh", "1");

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);

    try {
      await fetch(`/api/research/topics?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      // If we reach here quickly (< 3s), the compute finished immediately — refresh state.
      pollUpdate();
    } catch {
      // Expected AbortError: compute continues server-side; polling takes over.
    }
  }

  async function loadTopics(options?: { refresh?: boolean; loadOnly?: boolean }) {
    const refresh = Boolean(options?.refresh);
    const loadOnly = Boolean(options?.loadOnly);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), loadOnly ? 15000 : 1800000);

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (focusThemes.trim()) params.set("focus", focusThemes.trim());
      if (preset.trim()) params.set("preset", preset.trim());
      if (refresh) params.set("refresh", "1");
      if (loadOnly) params.set("loadOnly", "1");

      const res = await fetch(`/api/research/topics?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Research-Themen konnten nicht geladen werden");

      setTopics(Array.isArray(data.topics) ? data.topics : []);
      setLastUpdatedAt(typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString());
      setAiInfo(data.ai || null);
      setInflightRunning(Boolean(data.inflight));
      setInflightStartedAt(typeof data.inflightStartedAt === "string" ? data.inflightStartedAt : null);

      if (Array.isArray(data.focusThemes) && data.focusThemes.length > 0) {
        setFocusThemes(data.focusThemes.join(","));
      }

      if (typeof data.preset === "string" && data.preset) {
        setPreset(data.preset);
      }

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            topics: Array.isArray(data.topics) ? data.topics : [],
            focusThemes: Array.isArray(data.focusThemes) ? data.focusThemes : [],
            preset: typeof data.preset === "string" ? data.preset : preset,
            savedAt: typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString(),
          })
        );
      } catch {
        // Ignore storage errors in private mode or restricted browsers.
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("KI-Filter hat zu lange gebraucht (ueber 30 Minuten). Bitte Fokus-Themen eingrenzen oder Modell wechseln.");
      } else {
        setError(err?.message || "Research-Themen konnten nicht geladen werden");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function loadSnapshotList(presetValue: string, offset: number): Promise<SnapshotMeta[]> {
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const params = new URLSearchParams();
      params.set("preset", presetValue.trim());
      params.set("limit", String(SNAPSHOT_PAGE_SIZE));
      params.set("offset", String(offset));

      const res = await fetch(`/api/research/snapshots?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Snapshot-Historie konnte nicht geladen werden");

      const fetched: SnapshotMeta[] = Array.isArray(data.snapshots) ? data.snapshots : [];
      setSnapshotTotal(typeof data.total === "number" ? data.total : fetched.length);
      setSnapshotList((prev) => (offset === 0 ? fetched : [...prev, ...fetched]));
      return fetched;
    } catch (err: any) {
      setSnapshotError(err?.message || "Snapshot-Historie konnte nicht geladen werden");
      return [];
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function viewSnapshot(id: string) {
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const params = new URLSearchParams();
      params.set("preset", preset.trim());
      params.set("snapshotId", id);

      const res = await fetch(`/api/research/topics?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Snapshot konnte nicht geladen werden");

      setViewingSnapshotId(id);
      setTopics(Array.isArray(data.topics) ? data.topics : []);
      setLastUpdatedAt(typeof data.generatedAt === "string" ? data.generatedAt : null);
      setAiInfo(data.ai || null);
      setPage(0);
    } catch (err: any) {
      setSnapshotError(err?.message || "Snapshot konnte nicht geladen werden");
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function goToLatest() {
    setViewingSnapshotId(null);
    setPage(0);
    await loadTopics({ loadOnly: true });
  }

  async function goOlder() {
    const currentIndex = viewingSnapshotId
      ? snapshotList.findIndex((s) => s.id === viewingSnapshotId)
      : 0;
    if (currentIndex === -1) return;

    if (currentIndex + 1 < snapshotList.length) {
      await viewSnapshot(snapshotList[currentIndex + 1].id);
      return;
    }

    if (snapshotList.length < snapshotTotal) {
      const appended = await loadSnapshotList(preset, snapshotList.length);
      if (appended.length > 0) {
        await viewSnapshot(appended[0].id);
      }
    }
  }

  async function goNewer() {
    const currentIndex = viewingSnapshotId
      ? snapshotList.findIndex((s) => s.id === viewingSnapshotId)
      : 0;
    if (currentIndex <= 0) {
      if (viewingSnapshotId !== null) await goToLatest();
      return;
    }
    await viewSnapshot(snapshotList[currentIndex - 1].id);
  }

  async function dispatchTopic(topic: Topic, options?: { force?: boolean }) {
    try {
      setDispatchingKey(topic.key);
      setError(null);
      setNotice(null);

      const res = await fetch("/api/research/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.title,
          topicUrl: topic.url,
          authorId: topic.suggestedAuthor?.id,
          publish,
          force: Boolean(options?.force),
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Research-Auftrag konnte nicht gestartet werden");

      setDispatchedKeys((prev) => new Set(prev).add(topic.key));
      setNotice(`Research-Auftrag gestartet. Autor: ${data.author}. JobRun: ${data.jobRunId}`);
    } catch (err: any) {
      setError(err?.message || "Research-Auftrag konnte nicht gestartet werden");
    } finally {
      setDispatchingKey(null);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          topics?: Topic[];
          focusThemes?: string[];
          preset?: string;
          savedAt?: string;
        };

        if (Array.isArray(parsed.topics)) setTopics(parsed.topics);
        if (Array.isArray(parsed.focusThemes) && parsed.focusThemes.length > 0) {
          setFocusThemes(parsed.focusThemes.join(","));
        }
        if (typeof parsed.preset === "string" && parsed.preset) setPreset(parsed.preset);
        if (typeof parsed.savedAt === "string") setLastUpdatedAt(parsed.savedAt);
      }
    } catch {
      // Ignore invalid storage payloads.
    }

    // Load latest DB snapshot for all users, without triggering an AI compute.
    loadTopics({ loadOnly: true }).catch(() => {
      // Silent fallback: keep localStorage state.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re-)load the snapshot history whenever the preset changes, and drop out
  // of any historical view since it belonged to the previous preset.
  useEffect(() => {
    setSnapshotList([]);
    setSnapshotTotal(0);
    setViewingSnapshotId(null);
    loadSnapshotList(preset, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    if (viewingSnapshotId === null) setPage(0);
  }, [lastUpdatedAt, viewingSnapshotId]);

  const totalPages = Math.max(1, Math.ceil(topics.length / PAGE_SIZE));
  const pagedTopics = useMemo(
    () => topics.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [topics, page]
  );

  const snapshotIndex = viewingSnapshotId
    ? snapshotList.findIndex((s) => s.id === viewingSnapshotId)
    : 0;
  const hasOlderSnapshot =
    snapshotIndex !== -1 && (snapshotIndex + 1 < snapshotList.length || snapshotList.length < snapshotTotal);
  const hasNewerSnapshot = viewingSnapshotId !== null;
  const viewingSnapshotMeta = snapshotIndex >= 0 ? snapshotList[snapshotIndex] : null;

  const currentCacheKey = useMemo(() => {
    const themes = focusThemes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return `${preset.trim()}::${themes.join("|")}`;
  }, [preset, focusThemes]);

  const runForCurrentSelection = useMemo(
    () => activeRuns.find((run) => run.cacheKey === currentCacheKey) || null,
    [activeRuns, currentCacheKey]
  );

  const someoneElseIsRunning = activeRuns.length > 0;
  const disableStart = inflightRunning || Boolean(runForCurrentSelection);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--primary-strong)] via-[var(--primary)] to-[var(--accent)] px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
              <SparklesIcon className="h-3.5 w-3.5" />
              Research Desk
            </p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight">Hot Topics &amp; Auto-Briefing</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Sammelt virale Themen aus TMDB, TVMaze, Entertainment-RSS, Subreddits u.a. und schlaegt passende Autoren vor.
            </p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">
            <input
              type="checkbox"
              checked={publish}
              onChange={(event) => setPublish(event.target.checked)}
              className="h-3.5 w-3.5 accent-white"
            />
            Direkt publizieren
          </label>
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Quellen-Preset</label>
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Fokus-Themen (KI Filter)</label>
            <input
              type="text"
              value={focusThemes}
              onChange={(event) => setFocusThemes(event.target.value)}
              placeholder="z.B. casting, staffel, scandal"
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <button
              type="button"
              onClick={startBackgroundCompute}
              disabled={disableStart}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparklesIcon className="h-4 w-4" />
              {disableStart ? "Laeuft..." : "KI-Filter anwenden"}
            </button>
          </div>
        </div>

        {(lastUpdatedAt || aiInfo) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {lastUpdatedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold text-[var(--foreground)]">
                <ClockIcon className="h-3.5 w-3.5 text-[var(--muted)]" />
                {formatDateTime(lastUpdatedAt)}
              </span>
            )}
            {aiInfo && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ring-1 ${aiInfo.usedAI ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
                <ShieldIcon className="h-3.5 w-3.5" />
                {aiInfo.usedAI
                  ? `KI aktiv - ${aiInfo.aiIncluded}/${aiInfo.inputTopics} akzeptiert`
                  : `Heuristik-Fallback (${aiInfo.fallbackReason || aiInfo.aiError || "unbekannt"})`}
                {typeof aiInfo.aiDurationMs === "number" && <span className="text-[var(--muted)]">{Math.round(aiInfo.aiDurationMs / 1000)}s</span>}
              </span>
            )}
          </div>
        )}

        {snapshotTotal > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goOlder}
                disabled={snapshotLoading || !hasOlderSnapshot}
                className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                &#9664; Aelter
              </button>
              <button
                type="button"
                onClick={goNewer}
                disabled={snapshotLoading || !hasNewerSnapshot}
                className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Neuer &#9654;
              </button>
              {viewingSnapshotId !== null && (
                <button
                  type="button"
                  onClick={goToLatest}
                  className="rounded-lg bg-[var(--primary)] px-2.5 py-1.5 font-semibold text-white"
                >
                  Zur aktuellsten Ansicht
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              {viewingSnapshotId === null ? (
                <span className="font-semibold text-[var(--foreground)]">Aktuell (Live)</span>
              ) : (
                <span>Snapshot vom {formatDateTime(viewingSnapshotMeta?.generatedAt)}</span>
              )}
              <span>
                {snapshotIndex >= 0 ? snapshotIndex + 1 : 1} / {snapshotTotal}
              </span>
            </div>
          </div>
        )}

        {snapshotError && (
          <p className="mt-2 text-xs text-rose-700">{snapshotError}</p>
        )}

        {topics.length === 0 && !loading && (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            Noch keine Hot Topics geladen. Klicke auf <span className="font-semibold text-[var(--foreground)]">KI-Filter anwenden</span> um zu starten.
          </p>
        )}

        {(inflightRunning || someoneElseIsRunning) && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">
              KI-Filter laeuft im Hintergrund (Live-Status fuer alle Nutzer).
              {runForCurrentSelection
                ? ` Laufzeit fuer diese Auswahl: ${formatDurationSince(runForCurrentSelection.startedAt)}.`
                : inflightRunning && inflightStartedAt
                ? ` Laufzeit: ${formatDurationSince(inflightStartedAt)}.`
                : ""}{" "}
              Weitere Klicks starten keinen zweiten Lauf &mdash; das Ergebnis erscheint automatisch fuer alle, sobald es fertig ist.
            </p>
            {activeRuns.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {activeRuns.map((run) => (
                  <li key={run.cacheKey} className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
                    <span className="font-semibold uppercase tracking-wide">{run.preset}</span>
                    <span className="text-amber-800">{run.focusThemes.join(", ") || "(keine Fokus-Themen)"}</span>
                    <span className="text-amber-800">Laufzeit: {formatDurationSince(run.startedAt)}</span>
                    {run.cacheKey === currentCacheKey && (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        Deine Auswahl
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <span aria-hidden="true" className="hidden">{tick}</span>
          </div>
        )}

        {notice && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
        )}

      {topics.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>
            Seite {page + 1} / {totalPages} ({topics.length} Themen)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &#9664; Zurueck
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Weiter &#9654;
            </button>
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-3">
          {pagedTopics.map((topic) => {
            const commissioned = dispatchedKeys.has(topic.key) || Boolean(topic.duplicate && topic.duplicate.matchType !== "semantic");
            const semanticWarning = !commissioned && topic.duplicate?.matchType === "semantic" ? topic.duplicate : null;

            return (
            <li key={topic.key}>
              <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition-all duration-200 open:shadow-md open:ring-1 open:ring-[var(--primary)]/15 hover:border-[var(--primary)]/30 hover:shadow-md">
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 [&::-webkit-details-marker]:hidden sm:flex-row sm:items-start sm:gap-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:contents">
                    <TrendRing score={topic.trendScore} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {topic.category && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${categoryTone(topic.category)}`}>
                            {topic.category}
                          </span>
                        )}
                        {semanticWarning && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200"
                            title={`${semanticWarning.title} — Ähnlichkeit ${Math.round(semanticWarning.score * 100)}%`}
                          >
                            <AlertIcon className="h-3 w-3" />
                            Ähnlicher Artikel
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-[15px] font-bold leading-snug text-[var(--foreground)] group-open:line-clamp-none sm:line-clamp-2">
                        {topic.titleDe || topic.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1" title="KI-Relevanz">
                          <SparklesIcon className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">{topic.aiRelevance}</span>
                          <span>KI-Relevanz</span>
                        </span>
                        <span className="inline-flex items-center gap-1" title={topic.sources.join(", ")}>
                          <ShieldIcon className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">{topic.sourceCount}</span>
                          <span>{topic.sourceCount === 1 ? "Quelle" : "Quellen"}</span>
                        </span>
                        <span className="inline-flex items-center gap-1" title={formatDateTime(topic.publishedAt)}>
                          <ClockIcon className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                          {formatRelativeTime(topic.publishedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                    {commissioned ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {topic.duplicate?.slug ? (
                          <a
                            href={`/article/${topic.duplicate.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-alt)]"
                          >
                            Artikel ansehen
                          </a>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-xs font-bold text-[var(--muted)]">
                              <span className="block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
                              Läuft bereits
                            </span>
                            <button
                              type="button"
                              onClick={(event) => { event.preventDefault(); event.stopPropagation(); dispatchTopic(topic, { force: true }); }}
                              disabled={dispatchingKey === topic.key}
                              className="text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--primary)] hover:underline disabled:opacity-60"
                            >
                              {dispatchingKey === topic.key ? "Starte..." : "Trotzdem neu erstellen"}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => { event.preventDefault(); event.stopPropagation(); dispatchTopic(topic); }}
                        disabled={dispatchingKey === topic.key}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {dispatchingKey === topic.key && (
                          <span className="block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        )}
                        {dispatchingKey === topic.key ? "Starte..." : semanticWarning ? "Trotzdem beauftragen" : "Artikel beauftragen"}
                      </button>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)] transition-colors group-open:text-[var(--primary)]">
                      Details
                      <ChevronIcon className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" />
                    </span>
                  </div>
                </summary>

                <div className="space-y-4 border-t border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 sm:px-5">
                  {topic.titleDe && topic.titleDe !== topic.title && (
                    <p className="text-xs italic text-[var(--muted)]">Original: {topic.title}</p>
                  )}

                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Kennzahlen</p>
                    <div className="grid gap-x-4 gap-y-2 rounded-xl bg-white p-3 ring-1 ring-[var(--border)] sm:grid-cols-2">
                      <ScoreBar label="Trend" value={topic.trendScore} icon={TrendIcon} />
                      <ScoreBar label="KI-Rel." value={topic.aiRelevance} icon={SparklesIcon} />
                      <ScoreBar label="Velocity" value={topic.velocityScore ?? 0} icon={FireIcon} />
                      <ScoreBar label="Freshness" value={topic.freshnessScore ?? 0} icon={ClockIcon} />
                      <ScoreBar label="Engagement" value={topic.engagementScore ?? 0} icon={UsersIcon} />
                      <ScoreBar label="Autorität" value={topic.sourceWeightScore ?? 0} icon={ShieldIcon} />
                    </div>
                  </div>

                  {(topic.entities?.persons?.length || topic.entities?.works?.length || topic.entities?.studios?.length) ? (
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Erkannte Entitäten</p>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {topic.entities?.persons?.map((person) => (
                          <span key={`p-${topic.key}-${person}`} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)]">
                            {person}
                          </span>
                        ))}
                        {topic.entities?.works?.map((work) => (
                          <span key={`w-${topic.key}-${work}`} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--primary)] ring-1 ring-[var(--border)]">
                            {work}
                          </span>
                        ))}
                        {topic.entities?.studios?.map((studio) => (
                          <span key={`s-${topic.key}-${studio}`} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]">
                            {studio}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Themen-Match</p>
                      <p className="mt-1 text-xs text-[var(--foreground)]">
                        {topic.matchedThemes.length > 0 ? topic.matchedThemes.join(", ") : "keine"}
                      </p>
                    </div>
                    {topic.sourceMix && topic.sourceMix.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Quellen-Mix</p>
                        <p className="mt-1 text-xs text-[var(--foreground)]">
                          {topic.sourceMix.map((entry) => `${entry.name} (${entry.count})`).join(", ")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white p-3 ring-1 ring-[var(--border)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Autorvorschlag</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--foreground)]">{topic.suggestedAuthor?.name || "Keine Empfehlung"}</p>
                    <div className="mt-2 border-t border-dashed border-[var(--border)] pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">KI-Begründung</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{topic.reasonDe || topic.aiReason}</p>
                    </div>
                  </div>
                </div>
              </details>
            </li>
            );
          })}

          {pagedTopics.length === 0 && !loading && (
            <li className="px-3 py-4 text-sm text-[var(--muted)]">Keine Topics verfuegbar.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

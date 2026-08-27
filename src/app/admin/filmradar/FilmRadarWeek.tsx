import type { ComparedFilm } from "@/lib/filmradar";
import { CheckIcon, WarningIcon } from "@/app/admin/JobIcons";
import Badge, { type BadgeTone } from "@/components/ui/Badge";

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-[var(--muted)]">kein Score</span>;
  }
  const tone: BadgeTone = score >= 70 ? "success" : score >= 40 ? "warning" : "neutral";
  return <Badge tone={tone}>{score} / 100</Badge>;
}

export default function FilmRadarWeek({ title, films, scored }: { title: string; films: ComparedFilm[]; scored: boolean }) {
  const missingCount = films.filter((f) => f.missingOnSpielfilm).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 sm:px-5">
        <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
        <div className="flex items-center gap-2">
          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-rose-200">
              {missingCount} fehlen auf Spielfilm.de
            </span>
          )}
          {scored && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Sortiert nach Zugriffspotential</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {films.map((film, index) => (
          <div key={`${film.title}-${index}`} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${film.missingOnSpielfilm ? "bg-rose-50/40" : ""}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                film.missingOnSpielfilm ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}
              title={film.missingOnSpielfilm ? "Fehlt auf Spielfilm.de" : "Bereits auf Spielfilm.de vorhanden"}
            >
              {film.missingOnSpielfilm ? <WarningIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--foreground)]">{film.title}</p>
              <p className="text-xs text-[var(--muted)]">{film.distributor}</p>
            </div>

            {film.missingOnSpielfilm && scored && <ScorePill score={film.signals?.score} />}

            {!film.missingOnSpielfilm && film.matchedSpielfilmUrl && (
              <a
                href={film.matchedSpielfilmUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--primary)] transition hover:bg-[var(--surface-alt)]"
              >
                Auf Spielfilm.de ansehen
              </a>
            )}
          </div>
        ))}
        {films.length === 0 && <p className="px-5 py-4 text-sm text-[var(--muted)]">Keine Filme in dieser Woche.</p>}
      </div>
    </div>
  );
}

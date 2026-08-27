import { revalidatePath } from "next/cache";
import {
  runFilmRadarComparison,
  saveFilmRadarSnapshot,
  getLatestFilmRadarSnapshot,
  isOmdbConfigured,
} from "@/lib/filmradar";
import FilmRadarWeek from "@/app/admin/filmradar/FilmRadarWeek";
import RefreshFilmRadarButton from "@/app/admin/filmradar/RefreshFilmRadarButton";
import { WarningIcon } from "@/app/admin/JobIcons";
import { formatRelativeTime } from "@/lib/format";
import StatGrid from "@/components/ui/StatGrid";
import PageContainer from "@/components/ui/PageContainer";

function formatWeekDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export default async function FilmRadarPage() {
  async function refreshAction() {
    "use server";

    const result = await runFilmRadarComparison();
    await saveFilmRadarSnapshot(result);
    revalidatePath("/admin/filmradar");
  }

  let snapshot = await getLatestFilmRadarSnapshot();

  // First ever visit, before the scheduler's had a chance to run: compute
  // once live so the page isn't just an empty "nothing here yet" state, and
  // persist it so every visit after this one reads from the DB.
  if (!snapshot) {
    const result = await runFilmRadarComparison();
    await saveFilmRadarSnapshot(result);
    snapshot = result;
  }

  const omdbConfigured = isOmdbConfigured();
  const { weeks, totalVdf, totalMissing, generatedAt, errorMessage } = snapshot;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Vergleicht die offizielle Filmstartliste der Verleiher (allscreens.de) mit der Redaktionsliste im
            Spielfilm.de-CMS und zeigt, welche Titel dort noch fehlen - sortiert innerhalb jeder Startwoche nach
            geschaetztem Zugriffspotential im DACH-Raum. Wird automatisch alle paar Stunden aktualisiert.
          </p>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Letzter Lauf: {formatRelativeTime(generatedAt)} ({new Date(generatedAt).toLocaleString("de-DE")})
          </p>
        </div>
        <RefreshFilmRadarButton refreshAction={refreshAction} />
      </div>

      {!omdbConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <WarningIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-amber-800">Kein Zugriffspotential-Score - OMDb-Key fehlt</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Die Listen-Differenz (fehlende Titel mit Verleih und Datum) funktioniert bereits vollstaendig. Fuer den
              Score (IMDb- + Rotten-Tomatoes-Wertung) fehlt ein kostenloser API-Key von{" "}
              <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer" className="font-bold underline">
                omdbapi.com
              </a>
              , eingetragen als <code className="rounded bg-white px-1 py-0.5">OMDB_API_KEY</code> in der{" "}
              <code className="rounded bg-white px-1 py-0.5">.env</code>. Echter Social-Media-Buzz (Facebook,
              Instagram, TikTok, X, Bluesky) ist ohne bezahlte Plattform-APIs nicht verfuegbar und daher bewusst nicht
              enthalten.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <WarningIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-rose-800">FILMRADAR konnte nicht geladen werden</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{errorMessage}</p>
          </div>
        </div>
      )}

      {!errorMessage && (
        <>
          <StatGrid
            className="mb-8"
            columns={3}
            stats={[
              { label: "Filme auf VDF-Liste", value: totalVdf },
              { label: "Fehlen auf Spielfilm.de", value: totalMissing, tone: "danger" },
              { label: "Startwochen", value: weeks.length, tone: "success" },
            ]}
          />

          <div className="space-y-6">
            {weeks.map((week, index) => (
              <FilmRadarWeek
                key={week.releaseDate}
                title={formatWeekDate(week.releaseDate)}
                films={week.films}
                scored={index < 2 && omdbConfigured}
              />
            ))}
            {weeks.length === 0 && (
              <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-[var(--muted)]">
                Keine Filmstarts gefunden.
              </p>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}

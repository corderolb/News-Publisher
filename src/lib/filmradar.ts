import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";

const CMS_BASE_URL = process.env.FILMRADAR_CMS_BASE_URL || "https://redaktion2013.spielfilm.de";
const CMS_USER = process.env.FILMRADAR_CMS_USER;
const CMS_PASSWORD = process.env.FILMRADAR_CMS_PASSWORD;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const REFRESH_INTERVAL_HOURS = Math.max(1, Number(process.env.FILMRADAR_REFRESH_INTERVAL_HOURS || 4));

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type VdfFilm = {
  title: string;
  distributor: string;
  releaseDate: string; // ISO yyyy-mm-dd
};

export type SpielfilmFilm = {
  id: string;
  titleDe: string;
  titleOriginal: string;
  releaseDate: string;
  teaser: string;
  url: string;
};

export type AccessSignals = {
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
  score: number | null; // 0-100, null if OMDB_API_KEY not configured or film not found
};

export type ComparedFilm = {
  title: string;
  distributor: string;
  releaseDate: string;
  missingOnSpielfilm: boolean;
  matchedSpielfilmTitle?: string;
  matchedSpielfilmUrl?: string;
  signals?: AccessSignals;
};

export type WeekGroup = {
  releaseDate: string;
  films: ComparedFilm[];
};

function parseGermanDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, d, mo, y] = match;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// The VDF-side list: allscreens.de aggregates the official distributor
// release schedule as one <h2>date</h2> + <table class="table"> block per
// upcoming release date - public, no auth needed.
export async function fetchVdfList(): Promise<VdfFilm[]> {
  const response = await fetch("https://allscreens.de/filmstarts", {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`allscreens.de nicht erreichbar (HTTP ${response.status})`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const films: VdfFilm[] = [];

  $("h2").each((_, headingEl) => {
    const releaseDate = parseGermanDate($(headingEl).text());
    if (!releaseDate) return;

    // The date <h2> lives inside its own small wrapper div - the actual
    // <table class="table"> is a sibling of that wrapper, not of the h2
    // itself, so nextAll() has to start from the parent.
    const table = $(headingEl).parent().nextAll("table.table").first();
    if (!table.length) return;

    table.find("tr").each((__, rowEl) => {
      const cells = $(rowEl).find("td");
      if (cells.length < 3) return;

      const titleCell = cells.eq(1).clone();
      titleCell.find("a").remove();
      const title = titleCell.find("p").first().text().trim().replace(/\s+/g, " ");
      const distributor = cells.eq(2).find("div").first().text().trim().replace(/\s+/g, " ") || cells.eq(2).text().trim();

      if (!title) return;
      films.push({ title, distributor, releaseDate });
    });
  });

  return films;
}

let cmsCookie: string | null = null;

async function ensureCmsSession(): Promise<string> {
  if (cmsCookie) return cmsCookie;
  if (!CMS_USER || !CMS_PASSWORD) {
    throw new Error("FILMRADAR_CMS_USER/FILMRADAR_CMS_PASSWORD nicht in .env konfiguriert");
  }

  const url = `${CMS_BASE_URL}/redaktion.php?do=filme`;
  const initial = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(15000) });
  const sessionCookie = (initial.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("PHPSESSID="));
  if (!sessionCookie) throw new Error("Spielfilm.de CMS: keine Session erhalten");

  const form = new URLSearchParams();
  form.set("nutzername", CMS_USER);
  form.set("passwd", CMS_PASSWORD);

  const loginRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
      "User-Agent": BROWSER_UA,
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });

  const buffer = await loginRes.arrayBuffer();
  const text = new TextDecoder("iso-8859-1").decode(buffer);
  if (/name="passwd"/.test(text)) {
    throw new Error("Spielfilm.de CMS-Login fehlgeschlagen - Zugangsdaten pruefen");
  }

  cmsCookie = sessionCookie;
  return sessionCookie;
}

// The Spielfilm.de-side list: the editorial CMS's own "Filme" admin table.
// Each row exposes a stable public article id/URL (spielfilm.de/filme/{id}/)
// and cleanly separates the German title (<b>) from the original title
// (after <br>), which is what makes the title match against the VDF list
// reliable instead of relying on the squashed .text() of the whole cell.
export async function fetchSpielfilmList(): Promise<SpielfilmFilm[]> {
  const cookie = await ensureCmsSession();
  const url = `${CMS_BASE_URL}/redaktion.php?do=filme`;

  const response = await fetch(url, {
    headers: { Cookie: cookie, "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(20000),
  });
  const buffer = await response.arrayBuffer();
  const html = new TextDecoder("iso-8859-1").decode(buffer);

  if (/name="passwd"/.test(html)) {
    cmsCookie = null;
    throw new Error("Spielfilm.de CMS-Session abgelaufen - bitte Seite neu laden");
  }

  const $ = cheerio.load(html);
  const films: SpielfilmFilm[] = [];

  $("table.main").eq(1).find("tr").each((_, rowEl) => {
    const row = $(rowEl);
    const link = row.find('a[href*="spielfilm.de/filme/"]').first();
    const idMatch = link.attr("href")?.match(/\/filme\/(\d+)\//);
    if (!idMatch) return;

    const cells = row.find("td");
    const dateCell = cells.filter((__, el) => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test($(el).text().trim())).first();
    const releaseDate = parseGermanDate(dateCell.text());
    if (!releaseDate) return;

    const titleCell = dateCell.next("td");
    const titleDe = titleCell.find("b").first().text().trim();
    const titleOriginal = titleCell
      .clone()
      .find("b")
      .remove()
      .end()
      .text()
      .trim();

    const teaser = titleCell.next("td").text().trim();

    films.push({
      id: idMatch[1],
      titleDe: titleDe || titleCell.text().trim(),
      titleOriginal,
      releaseDate,
      teaser,
      url: `https://www.spielfilm.de/filme/${idMatch[1]}/`,
    });
  });

  return films;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Straight substring matching misses real matches when the two sites format
// the same title differently - e.g. VDF appends a format tag ("... IMAX")
// where Spielfilm.de appends the full German subtitle instead. Falling back
// to word-overlap (paired with the release-date window in compareLists)
// catches those without just doing a loose "share any word" match.
function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  const tokensA = na.split(" ").filter(Boolean);
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  const shorterLength = Math.min(tokensA.length, tokensB.size);
  if (shorterLength === 0) return false;

  const shared = tokensA.filter((token) => tokensB.has(token)).length;
  return shared / shorterLength >= 0.6;
}

// A film only counts as "present" on Spielfilm.de if the release dates are
// also close together (14 days) - otherwise an older re-release or an
// unrelated film that happens to share a title could hide a genuine gap.
const MATCH_WINDOW_DAYS = 14;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

export function compareLists(vdfList: VdfFilm[], spielfilmList: SpielfilmFilm[]): ComparedFilm[] {
  return vdfList.map((vdfFilm) => {
    const match = spielfilmList.find(
      (sf) =>
        daysBetween(sf.releaseDate, vdfFilm.releaseDate) <= MATCH_WINDOW_DAYS &&
        (titlesMatch(sf.titleDe, vdfFilm.title) || titlesMatch(sf.titleOriginal, vdfFilm.title))
    );

    return {
      title: vdfFilm.title,
      distributor: vdfFilm.distributor,
      releaseDate: vdfFilm.releaseDate,
      missingOnSpielfilm: !match,
      matchedSpielfilmTitle: match?.titleDe,
      matchedSpielfilmUrl: match?.url,
    };
  });
}

export function groupByWeek(films: ComparedFilm[]): WeekGroup[] {
  const grouped = new Map<string, ComparedFilm[]>();
  for (const film of films) {
    const list = grouped.get(film.releaseDate) || [];
    list.push(film);
    grouped.set(film.releaseDate, list);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([releaseDate, weekFilms]) => ({ releaseDate, films: weekFilms }));
}

export function isOmdbConfigured(): boolean {
  return Boolean(OMDB_API_KEY);
}

// Estimates DACH "Zugriffspotential" from IMDb rating + Rotten Tomatoes
// score via the free OMDb API (one legitimate call covers both - direct
// IMDb/RT scraping is blocked by bot detection, and there is no free
// Google Trends API; both were tested and ruled out for this feature).
export async function fetchAccessSignals(title: string): Promise<AccessSignals> {
  if (!OMDB_API_KEY) return { imdbRating: null, rottenTomatoesScore: null, score: null };

  try {
    const response = await fetch(
      `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&type=movie`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await response.json();
    if (data?.Response === "False") return { imdbRating: null, rottenTomatoesScore: null, score: null };

    const imdbRating = Number.isFinite(Number(data?.imdbRating)) ? Number(data.imdbRating) : null;
    const rtEntry = Array.isArray(data?.Ratings)
      ? data.Ratings.find((r: { Source: string; Value: string }) => r.Source === "Rotten Tomatoes")
      : null;
    const rottenTomatoesScore = rtEntry ? Number(String(rtEntry.Value).replace("%", "")) : null;

    const parts = [imdbRating !== null ? imdbRating * 10 : null, rottenTomatoesScore].filter(
      (v): v is number => v !== null
    );
    const score = parts.length > 0 ? Math.round(parts.reduce((sum, v) => sum + v, 0) / parts.length) : null;

    return { imdbRating, rottenTomatoesScore, score };
  } catch {
    return { imdbRating: null, rottenTomatoesScore: null, score: null };
  }
}

// Enriches only missing-on-Spielfilm.de films (that's the actionable set -
// what an editor needs to decide what to cover) within the given weeks,
// keeping the page fast instead of scoring every film in the full schedule.
export async function enrichWithAccessSignals(weeks: WeekGroup[], weekLimit = 2): Promise<WeekGroup[]> {
  if (!OMDB_API_KEY) return weeks;

  const targetWeeks = weeks.slice(0, weekLimit);
  const rest = weeks.slice(weekLimit);

  const enrichedTarget = await Promise.all(
    targetWeeks.map(async (week) => ({
      ...week,
      films: await Promise.all(
        week.films.map(async (film) => {
          if (!film.missingOnSpielfilm) return film;
          const signals = await fetchAccessSignals(film.title);
          return { ...film, signals };
        })
      ),
    }))
  );

  const sortedTarget = enrichedTarget.map((week) => ({
    ...week,
    films: [...week.films].sort((a, b) => (b.signals?.score ?? -1) - (a.signals?.score ?? -1)),
  }));

  return [...sortedTarget, ...rest];
}

export type FilmRadarResult = {
  weeks: WeekGroup[];
  totalVdf: number;
  totalMissing: number;
  generatedAt: string;
  errorMessage: string | null;
};

// The actual end-to-end run: VDF scrape + CMS login/scrape + diff + OMDb
// enrichment for the nearest weeks. Called both by the scheduler and by the
// admin page's manual "Jetzt aktualisieren" button - always the same work,
// just triggered differently.
export async function runFilmRadarComparison(): Promise<FilmRadarResult> {
  const generatedAt = new Date().toISOString();

  try {
    const [vdfList, spielfilmList] = await Promise.all([fetchVdfList(), fetchSpielfilmList()]);
    const compared = compareLists(vdfList, spielfilmList);
    const grouped = groupByWeek(compared);
    const weeks = await enrichWithAccessSignals(grouped, 2);

    return {
      weeks,
      totalVdf: vdfList.length,
      totalMissing: compared.filter((f) => f.missingOnSpielfilm).length,
      generatedAt,
      errorMessage: null,
    };
  } catch (error) {
    return {
      weeks: [],
      totalVdf: 0,
      totalMissing: 0,
      generatedAt,
      errorMessage: (error as Error)?.message || "FILMRADAR-Lauf fehlgeschlagen",
    };
  }
}

export async function saveFilmRadarSnapshot(result: FilmRadarResult): Promise<void> {
  await prisma.filmRadarSnapshot.create({
    data: {
      generatedAt: new Date(result.generatedAt),
      totalVdf: result.totalVdf,
      totalMissing: result.totalMissing,
      payload: JSON.stringify(result.weeks),
      errorMessage: result.errorMessage,
    },
  });
}

export async function getLatestFilmRadarSnapshot(): Promise<FilmRadarResult | null> {
  const snapshot = await prisma.filmRadarSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
  if (!snapshot) return null;

  let weeks: WeekGroup[] = [];
  try {
    weeks = JSON.parse(snapshot.payload);
  } catch {
    weeks = [];
  }

  return {
    weeks,
    totalVdf: snapshot.totalVdf,
    totalMissing: snapshot.totalMissing,
    generatedAt: snapshot.generatedAt.toISOString(),
    errorMessage: snapshot.errorMessage,
  };
}

// Runs the comparison and stores a snapshot, but only if the last one is
// older than the configured refresh interval (default 4h - "mehrmals
// taeglich"). Called from the 60s scheduler tick in instrumentation.ts, same
// due-check pattern as runNewsletterIfDue/runRadarScanIfDue.
export async function runFilmRadarIfDue(): Promise<void> {
  const latest = await prisma.filmRadarSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
  if (latest) {
    const ageHours = (Date.now() - latest.generatedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < REFRESH_INTERVAL_HOURS) return;
  }

  const result = await runFilmRadarComparison();
  await saveFilmRadarSnapshot(result);
}

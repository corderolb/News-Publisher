// Static documentation + defaults for every admin-editable LLM prompt in the
// app. This is intentionally code, not data: it must always describe exactly
// what the current call sites actually send, so it can't drift out of sync
// the way a DB-editable description could. The DB (see prompts.ts) only ever
// stores an override of the `defaultTemplate` text below - never the metadata.

export type PromptVariable = {
  token: string;
  description: string;
  sample: string;
};

export type PromptCategory = "Artikel-Erstellung" | "Recherche & Themen" | "Newsletter" | "Uebersetzung";

export type PromptDefinition = {
  key: string;
  label: string;
  category: PromptCategory;
  description: string;
  usageContext: string;
  defaultTemplate: string;
  variables: PromptVariable[];
};

const ARTICLE_WRITER_TEMPLATE = `Du bist ein Chefredakteur fuer ein professionelles Nachrichtenportal.

AUTORPROFIL
Name: {{AUTHOR_NAME}}
Bio: {{AUTHOR_BIO}}
Tonalitaet: {{AUTHOR_TONE}}
Sonderregeln: {{AUTHOR_INSTRUCTIONS}}

AUFGABE
Erstelle aus dem Originalmaterial plus externer Recherche einen neuen, journalistischen Artikel.
Der Text muss klar, faktenorientiert, praezise und ohne Halluzinationen sein.
Wenn Fakten nicht bestaetigt sind, formuliere vorsichtig.

WICHTIGE THEMEN-REGEL
Der Artikel behandelt AUSSCHLIESSLICH das eigentliche Sachthema aus dem ORIGINAL-TITEL
(z.B. der Prominente, der Film, die Serie, das Ereignis).
Schreibe niemals einen Meta-Artikel ueber die Datenquelle (Google Trends, Reddit,
TVMaze, Hacker News, RSS-Feeds oder das Aggregator-System selbst).
Wenn im Rohmaterial nur die Aggregator-Startseite verlinkt ist, verwende ausschliesslich
die externen Recherche-Quellen zur Faktenrecherche.
Schreibe den vollstaendigen Artikel auf Deutsch.

ORIGINAL-TITEL
{{ORIGINAL_TITLE}}

ORIGINAL-TEXT
{{ORIGINAL_TEXT}}

RECHERCHE-QUELLEN
{{RESEARCH_BLOCK}}

Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{
  "title": "string",
  "excerpt": "string (max 240 chars)",
  "body": "string (mehrere Absätze)",
  "seoTitle": "string (max 70 chars)",
  "keywords": ["string", "..."],
  "qualityScore": 0,
  "scoreBreakdown": {
    "factuality": 0,
    "clarity": 0,
    "structure": 0,
    "seo": 0,
    "explanation": "string (erklaert kurz warum der Score hoch/niedrig ist)"
  },
  "factChecklist": ["string", "..."],
  "followUpAngles": ["string", "..."]
}`;

const CITATION_TRANSLATOR_TEMPLATE = `Du bist ein Uebersetzer fuer ein deutschsprachiges Nachrichtenportal.
Uebersetze folgende Recherche-Zitate ins Deutsche. Eigennamen (Personen, Filme,
Serien, Studios, Marken) bleiben unveraendert.
Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{ "items": [{ "i": number, "title": string, "snippet": string }] }

INPUT:
{{INPUT_JSON}}`;

const HOT_TOPICS_DE_TRANSLATOR_TEMPLATE = `Du bist ein Uebersetzer fuer ein deutschsprachiges Entertainment-Nachrichtenportal.
Uebersetze fuer jedes Item eine natuerliche, redaktionelle deutsche Fassung des Titels
und der Begruendung (reason). Eigennamen (Personen, Filme, Serien, Studios) bleiben
unveraendert.
Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{ "items": [{ "i": number, "titleDe": string, "reasonDe": string }] }

INPUT:
{{INPUT_JSON}}`;

const HOT_TOPICS_FILTER_TEMPLATE = `Du bist eine modulare Research Engine fuer virale Trends.

PRIMAERER EINSATZBEREICH:
{{PRIMARY_DOMAIN}}

ZIELE:
1) Erkenne virale Trends fruehzeitig.
2) Trenne Signal von Rauschen.
3) Fasse mehrfach berichtete Ereignisse zu Trend-Events zusammen.
4) Liefere nachvollziehbare Relevanzbewertung inklusive Entitaeten.

AKTIVE FOKUS-THEMEN:
{{FOCUS_THEMES}}

AKTIVE TAXONOMIE:
{{DOMAIN_TAXONOMY}}

NER-REGELN:
- persons: reale Personen (z.B. Schauspieler, Regisseure, Promis).
- works: Filme, Serien, Staffeln, Alben oder aehnliche Werke.
- studios: Studios, Netzwerke, Plattformen oder Labels.
- Nur Entitaeten uebernehmen, die tatsaechlich im Titel vorkommen. Keine Erfindungen.

AUSGABE-REGELN:
- include=true nur wenn das Topic klar zum Fokus und zur Domane passt.
- Relevanzbereich 0..100.
- include=true nur bei relevance >= 65.
- matchedThemes nur aus der Fokusliste.
- category nur aus der Taxonomie.
- reason knapp und nachvollziehbar.
- Wenn unsicher, include=false.
- titleDe: natürliche, redaktionelle Uebersetzung des Titels ins Deutsche. Eigennamen (Personen, Werke, Studios) bleiben unveraendert.
- reasonDe: dieselbe reason auf Deutsch, kurz.

INPUT TOPICS:
{{TOPICS_JSON}}

Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{
  "items": [
    {
      "key": "string",
      "include": true,
      "relevance": 0,
      "matchedThemes": ["string"],
      "category": "string",
      "titleDe": "string",
      "reasonDe": "string",
      "entities": {
        "persons": ["string"],
        "works": ["string"],
        "studios": ["string"]
      },
      "reason": "string"
    }
  ]
}`;

const AUTHOR_MATCH_TEMPLATE = `Du bist Redaktionsleiter/in und weist Themen an Autoren aus einem festen Autorenstack zu.

AUTORENSTACK:
{{AUTHOR_LIST}}

AUFGABE:
Weise JEDEM der folgenden Themen genau einen Autor aus dem obigen Stack zu (per "id"). Entscheide anhand von Bio, Tonalitaet und Extra-Regeln des jeweiligen Autors, wer inhaltlich und stilistisch am besten zum Thema passt. Verschiedene Themen sollen, wenn es die Spezialisierung der Autoren hergibt, auch unterschiedlichen Autoren zugewiesen werden - waehle nicht routinemaessig immer denselben Autor.

INPUT THEMEN:
{{TOPICS_JSON}}

Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{
  "assignments": [
    { "key": "string", "authorId": "string", "reason": "string" }
  ]
}

reason: ein kurzer Satz auf Deutsch, der konkret benennt, welches Bio-, Tonalitaets- oder Regel-Merkmal des Autors zu diesem Thema passt.`;

const NEWSLETTER_CURATION_TEMPLATE = `Du bist Chefredakteur und stellst den {{CADENCE_LABEL}} Newsletter fuer ein deutschsprachiges Entertainment-Portal zusammen.

AUFGABE
Waehle aus der folgenden Artikelliste die {{TOP_N}} interessantesten fuer die Newsletter-Leser aus - nicht
zwingend die mit dem hoechsten Score, sondern nach Themenvielfalt und Nachrichtenwert - und ordne sie
nach Relevanz (wichtigstes zuerst). Schreibe zusaetzlich eine kurze, einladende Editorial-Einleitung
(2-3 Saetze) fuer den Newsletter, die einen Ueberblick gibt, worum es in dieser Ausgabe geht.

ARTIKEL
{{ARTICLES_JSON}}

Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{ "orderedIds": ["id", "..."], "intro": "string" }`;

const RADAR_SCORING_TEMPLATE = `Du bist Redaktionsleiter/in und bewertest neu entdeckte Artikel-Kandidaten nach ihrem redaktionellen Wert, bevor ueberhaupt ein Artikel daraus geschrieben wird.

AUFGABE
Bewerte jeden der folgenden Kandidaten mit einem Prioritaets-Score von 0 bis 100: wie lohnenswert ist es,
JETZT einen Artikel daraus zu schreiben? Hohe Werte fuer aktuelle, nachrichtenstarke, fuer das Publikum
relevante Themen; niedrige Werte fuer Nebensaechliches, reine Wiederholungen oder schwache Signale.

INPUT KANDIDATEN
{{ITEMS_JSON}}

Gib AUSSCHLIESSLICH gueltiges JSON aus (kein Markdown, kein Kommentar):
{
  "items": [
    { "key": "string", "score": 0, "reason": "string" }
  ]
}

reason: ein kurzer Satz auf Deutsch, der die Priorisierung nachvollziehbar macht.`;

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    key: "article-writer",
    label: "Artikel-Generator",
    category: "Artikel-Erstellung",
    description:
      "Schreibt den kompletten deutschen Artikel (Titel, Teaser, Fliesstext, SEO-Titel, Keywords, Qualitaets-Score samt Begruendung, Fact-Checkliste und Anschlussthemen) aus dem Original-Quellentext plus der uebersetzten externen Recherche - im Ton und Stil des jeweils zugewiesenen Autoren-Profils.",
    usageContext:
      "Der mit Abstand am haeufigsten ausgefuehrte Prompt im System: laeuft fuer JEDEN Radar-Kandidaten, sobald er einem Autor zugeordnet ist und an der Reihe ist (radar-write.ts), sowie einmal pro manuell angestossenem Recherche-Thema aus dem Research-Panel.",
    defaultTemplate: ARTICLE_WRITER_TEMPLATE,
    variables: [
      { token: "AUTHOR_NAME", description: "Name des zugewiesenen Autoren-Profils", sample: "Mara Volkmann" },
      { token: "AUTHOR_BIO", description: "Bio-Text des Autors (oder \"Nicht angegeben\")", sample: "Seit zehn Jahren Kino- und Streaming-Kritikerin, Schwerpunkt internationale Produktionen." },
      { token: "AUTHOR_TONE", description: "Konfigurierte Tonalitaet des Autors", sample: "Sachlich, klar, journalistisch" },
      { token: "AUTHOR_INSTRUCTIONS", description: "Sonderregeln des Autors (oder \"Keine\")", sample: "Keine Wertungen in der Ueberschrift, immer eine Quelle im Fliesstext nennen." },
      { token: "ORIGINAL_TITLE", description: "Original-Headline der Quelle", sample: "Ron Perlman Joins Lily James in Horror Thriller 'Seasons'" },
      { token: "ORIGINAL_TEXT", description: "Gescrapter Volltext der Original-Quelle", sample: "(gekuerzter Original-Artikeltext von der Quelle, mehrere Absaetze)" },
      { token: "RESEARCH_BLOCK", description: "Formatierte Liste der (bereits ins Deutsche uebersetzten) externen Recherche-Treffer", sample: "1. Ron Perlman uebernimmt Rolle in neuem Amazon-Horror-Projekt\nURL: https://example.com\nSnippet: Der Schauspieler stoesst zur Besetzung von 'Seasons'..." },
    ],
  },
  {
    key: "citation-translator",
    label: "Recherche-Zitate uebersetzen",
    category: "Uebersetzung",
    description:
      "Uebersetzt die Titel/Snippets der externen Recherche-Treffer (Brave Search, DuckDuckGo oder Wikipedia) ins Deutsche, bevor sie dem Artikel-Generator als Quellenmaterial uebergeben werden. Eigennamen bleiben unveraendert.",
    usageContext:
      "Laeuft pro Artikel-Kandidat direkt nach dem Web-Recherche-Schritt, unmittelbar bevor der Artikel-Generator-Prompt ausgefuehrt wird (radar-write.ts und research-jobs.ts).",
    defaultTemplate: CITATION_TRANSLATOR_TEMPLATE,
    variables: [
      { token: "INPUT_JSON", description: "JSON-Array der Recherche-Treffer: [{ i, title, snippet }]", sample: JSON.stringify([{ i: 0, title: "Ron Perlman joins horror thriller", snippet: "The actor will star in..." }]) },
    ],
  },
  {
    key: "hot-topics-de-translator",
    label: "Hot-Topics uebersetzen",
    category: "Uebersetzung",
    description:
      "Erzeugt eine natuerliche deutsche Fassung von Titel und Begruendung fuer Trend-Themen, die im Hot-Topics-Radar des Research-Panels angezeigt werden.",
    usageContext:
      "Laeuft am Ende eines Hot-Topics-Scans fuer alle Themen, denen noch keine deutsche Uebersetzung zugeordnet ist (research-topics.ts, ausgeloest ueber das Research-Panel).",
    defaultTemplate: HOT_TOPICS_DE_TRANSLATOR_TEMPLATE,
    variables: [
      { token: "INPUT_JSON", description: "JSON-Array der Themen: [{ i, title, reason }]", sample: JSON.stringify([{ i: 0, title: "Ron Perlman joins horror thriller", reason: "High engagement across 3 sources" }]) },
    ],
  },
  {
    key: "radar-scoring",
    label: "Radar-Priorisierung",
    category: "Recherche & Themen",
    description:
      "Bewertet jeden von der News-Radar-Quellenabtastung neu entdeckten Kandidaten (nur Titel + Quellen-Kategorie, noch kein Volltext) mit einem 0-100-Prioritaets-Score, bevor irgendetwas geschrieben wird. Bestimmt die Reihenfolge, in der Kandidaten spaeter tatsaechlich zu Artikeln verarbeitet werden.",
    usageContext:
      "Laeuft einmal pro Radar-Scan fuer alle neu entdeckten, noch unbewerteten Kandidaten in einem Batch (radar-score.ts -> scoreAndAssignRadarItems), direkt nach dem Scan und vor der Autoren-Zuordnung.",
    defaultTemplate: RADAR_SCORING_TEMPLATE,
    variables: [
      { token: "ITEMS_JSON", description: "JSON-Array der Kandidaten: [{ key, title, category }]", sample: JSON.stringify([{ key: "abc123", title: "Ron Perlman joins horror thriller 'Seasons'", category: "Filme und Serien" }]) },
    ],
  },
  {
    key: "hot-topics-filter",
    label: "Hot-Topics Relevanz-Filter",
    category: "Recherche & Themen",
    description:
      "Bewertet jedes eingesammelte Trend-Thema (aus RSS, Reddit, Google Trends, Hacker News, TVMaze) auf Relevanz zum konfigurierten Fokusgebiet, vergibt einen Relevanz-Score, ordnet es einer Kategorie zu und extrahiert Personen/Werke/Studios als Entitaeten. Das ist der zentrale Gatekeeper-Prompt fuer die Hot-Topics-Liste.",
    usageContext:
      "Laeuft einmal pro Hot-Topics-Scan fuer den gesamten gesammelten Themen-Batch, ausgeloest manuell oder automatisiert ueber das Research-Panel (research-topics.ts -> filterHotTopicsWithAI, /api/research/topics).",
    defaultTemplate: HOT_TOPICS_FILTER_TEMPLATE,
    variables: [
      { token: "PRIMARY_DOMAIN", description: "Konfiguriertes Fokusgebiet (RESEARCH_PRIMARY_DOMAIN)", sample: "Film, Serien, Schauspieler, Promi-News" },
      { token: "FOCUS_THEMES", description: "Kommagetrennte Liste aktiver Fokus-Themen", sample: "casting, staffel, scandal, box-office" },
      { token: "DOMAIN_TAXONOMY", description: "Kommagetrennte Liste der zulaessigen Kategorien", sample: "Casting & Announcement, Season Renewal / Cancellation, Personal / Lifestyle, Controversy / Scandal, General News / Reviews, Other" },
      { token: "TOPICS_JSON", description: "JSON-Array der zu bewertenden Themen: [{ key, title }]", sample: JSON.stringify([{ key: "ron-perlman-seasons", title: "Ron Perlman joins horror thriller 'Seasons'" }]) },
    ],
  },
  {
    key: "author-topic-match",
    label: "Autor-Themen-Zuordnung",
    category: "Recherche & Themen",
    description:
      "Weist jedem gefundenen Trend-Thema den inhaltlich und stilistisch am besten passenden Autor aus dem aktiven Autoren-Stack zu, basierend auf Bio, Tonalitaet und Sonderregeln - inklusive kurzer Begruendung je Zuordnung.",
    usageContext:
      "Laeuft nach dem Hot-Topics-Filter, sobald mehr als ein aktiver Autor existiert: einmal fuer den gesamten Batch nach einem Hot-Topics-Scan (research-topics.ts -> matchAuthorsForTopics), oder einzeln beim Dispatch eines ad-hoc Recherche-Jobs ohne explizit gewaehlten Autor (research-jobs.ts).",
    defaultTemplate: AUTHOR_MATCH_TEMPLATE,
    variables: [
      { token: "AUTHOR_LIST", description: "Formatierte Liste aller aktiven Autoren mit Bio/Tonalitaet/Sonderregeln", sample: "- id: \"author_1\"\n  Name: Mara Volkmann\n  Bio: Kino- und Streaming-Kritikerin\n  Tonalitaet: Sachlich, klar\n  Extra-Regeln: Keine" },
      { token: "TOPICS_JSON", description: "JSON-Array der zuzuordnenden Themen: [{ key, title }]", sample: JSON.stringify([{ key: "ron-perlman-seasons", title: "Ron Perlman joins horror thriller 'Seasons'" }]) },
    ],
  },
  {
    key: "newsletter-curation",
    label: "Newsletter-Kuratierung",
    category: "Newsletter",
    description:
      "Waehlt aus dem Artikel-Pool der jeweiligen Newsletter-Periode die relevantesten Beitraege aus, ordnet sie nach Themenvielfalt und Nachrichtenwert statt nur nach Score, und schreibt die einleitende Editorial-Zusammenfassung fuer die Ausgabe.",
    usageContext:
      "Laeuft beim TATSAECHLICHEN Versand eines Newsletters - sowohl bei 'Jetzt senden' als auch bei 'Test-Mail' und beim automatisierten Versand-Scheduler (newsletter.ts -> buildCuratedDigest). Die schnelle Vorschau in der Newsletter-Liste nutzt bewusst KEINEN KI-Aufruf (buildFallbackDigest), damit die Seite schnell laedt.",
    defaultTemplate: NEWSLETTER_CURATION_TEMPLATE,
    variables: [
      { token: "CADENCE_LABEL", description: "Deutsches Adjektiv fuer die Newsletter-Frequenz (\"taeglichen\"/\"woechentlichen\"/\"monatlichen\")", sample: "woechentlichen" },
      { token: "TOP_N", description: "Konfigurierte Anzahl an Top-Artikeln fuer diese Ausgabe", sample: "5" },
      { token: "ARTICLES_JSON", description: "JSON-Array der Kandidaten-Artikel: [{ id, title, excerpt, qualityScore }]", sample: JSON.stringify([{ id: "art_1", title: "Ron Perlman joins horror thriller", excerpt: "...", qualityScore: 82 }]) },
    ],
  },
];

export function getPromptDefinition(key: string): PromptDefinition | undefined {
  return PROMPT_DEFINITIONS.find((p) => p.key === key);
}

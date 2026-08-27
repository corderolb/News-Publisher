// Static documentation of every automated multi-step process in the app -
// what triggers it, and the exact ordered sequence of prompt calls and
// mechanical steps it runs through. This must always match what the code in
// radar-scan.ts, radar-score.ts, radar-write.ts, research-jobs.ts,
// research-topics.ts + api/research/topics, newsletter.ts, and filmradar.ts
// actually does - it is cross-referenced against those files by hand
// whenever their control flow changes.

export type ProcessStepType = "prompt" | "action" | "decision";

export type ProcessStep = {
  type: ProcessStepType;
  label: string;
  description: string;
  promptKey?: string;
  note?: string;
};

export type ProcessDefinition = {
  key: string;
  label: string;
  summary: string;
  trigger: string;
  loopHint?: string;
  steps: ProcessStep[];
};

export const PROCESS_DEFINITIONS: ProcessDefinition[] = [
  {
    key: "radar-scan",
    label: "News-Radar-Scan (Sammeln, Bewerten, Zuordnen)",
    summary:
      "Der Hauptprozess: durchsucht alle aktiven Quellen nach neuen Artikeln, bewertet jeden Kandidaten nach redaktioneller Prioritaet und ordnet ihn dem am besten passenden Autor zu - bevor irgendetwas geschrieben wird.",
    trigger:
      "Automatisch alle paar Minuten (Standard: 15, konfigurierbar unter Radar-Einstellungen) oder manuell ueber \"Jetzt ausfuehren\". Ersetzt die frueheren per-Kampagne-Zeitplaene - es gibt keine Kampagnen-Gruppierung mehr, alle aktiven Quellen werden in einem Lauf gescannt.",
    steps: [
      {
        type: "action",
        label: "Kandidaten sammeln (Discovery)",
        description: "Pro aktiver Quelle: RSS-Feed parsen oder HTML-Seite scrapen - bis zu \"Max. Items pro Lauf\" Kandidaten je Quelle. Neue Kandidaten werden als DISCOVERED in die Radar-Warteschlange eingereiht.",
        note: "Kein Volltext-Abruf und keine semantische Duplikat-Pruefung an dieser Stelle - beides bewusst auf den naechsten Schritt verschoben, damit ein Scan, der nichts Neues findet, schnell bleibt.",
      },
      {
        type: "decision",
        label: "Duplikat-Check",
        description: "Exakter URL-Treffer gegen bestehende Artikel -> sofort ueberspringen, AUSSER der bestehende Artikel hat Status FAILED (dann gilt er als nicht vorhanden und wird erneut versucht). Zusaetzlich semantischer Titel-Vergleich per Embeddings (LM Studio /v1/embeddings - kein Text-Prompt) ueber alle neu entdeckten Kandidaten.",
        note: "Ein frueherer fehlgeschlagener Versuch blockiert den Kandidaten nicht mehr dauerhaft - sonst wuerde ein einziger Generierungs-Fehler diese Quell-URL fuer immer sperren.",
      },
      {
        type: "prompt",
        label: "Radar-Priorisierung",
        promptKey: "radar-scoring",
        description: "Bewertet alle verbliebenen, noch unbewerteten Kandidaten in einem Batch mit einem 0-100-Prioritaets-Score (nur Titel + Quellen-Kategorie, noch kein Volltext).",
        note: "Bei Timeout oder Fehler: flacher Fallback-Score (50) fuer den ganzen Batch, damit kein Kandidat kommentarlos verloren geht - anders als beim Hot-Topics-Filter gibt es hier keinen Keyword-Fallback.",
      },
      {
        type: "prompt",
        label: "Autor-Zuordnung",
        promptKey: "author-topic-match",
        description: "Weist allen bewerteten Kandidaten (die nicht unter dem konfigurierten Mindest-Score liegen) den am besten passenden Autor aus dem aktiven Autoren-Stack zu.",
        note: "Direkte Wiederverwendung derselben Funktion, die auch der Hot-Topics-Scan fuer die Autor-Zuordnung nutzt.",
      },
      {
        type: "action",
        label: "In Schreib-Warteschlange einreihen",
        description: "Reiht zugeordnete Kandidaten (hoechster Score zuerst) als einzelne Jobs in die globale Warteschlange ein - begrenzt durch das taegliche Artikel-Limit und den Sicherheitsabbruch (siehe News-Radar-Artikel schreiben).",
        note: "Die Priorisierung und Autor-Zuordnung selbst laeuft als eigener Job in derselben globalen Warteschlange wie das Schreiben - Scoring, Autor-Zuordnung und Artikel-Generierung senden alle Anfragen an LM Studio, deshalb duerfen sie nie gleichzeitig laufen (LM Studio akzeptiert nur eine Anfrage auf einmal).",
      },
    ],
  },
  {
    key: "radar-write",
    label: "News-Radar-Artikel schreiben",
    summary:
      "Schreibt genau EINEN bereits zugeordneten Radar-Kandidaten fertig - Volltext laden, recherchieren, Artikel erstellen, speichern.",
    trigger:
      "Automatisch, sobald ein Kandidat in der Warteschlange an der Reihe ist (siehe News-Radar-Scan, letzter Schritt). Es laeuft global immer nur EIN Artikel gleichzeitig - alles andere wartet, bis der aktuelle fertig ist.",
    steps: [
      {
        type: "action",
        label: "Volltext laden",
        description: "Ruft jetzt erst (nicht schon beim Scan) die Original-Artikelseite ab und extrahiert den Haupttext. Bei zu wenig Inhalt (unter 200 Zeichen) schlaegt der Versuch fehl.",
        note: "Bewusst spaet: ein Kandidat, der ohnehin niedrig priorisiert waere, zahlt nie die Kosten eines Volltext-Abrufs.",
      },
      {
        type: "action",
        label: "Web-Recherche",
        description: "Sucht ergaenzende externe Quellen zum Thema - zuerst Brave Search API, sonst DuckDuckGo, sonst Wikipedia als letzter Fallback.",
      },
      {
        type: "prompt",
        label: "Zitate uebersetzen",
        promptKey: "citation-translator",
        description: "Uebersetzt die gefundenen Recherche-Quellen ins Deutsche.",
        note: "Das Ergebnis wird NICHT in den Artikel-Generator-Prompt (naechster Schritt) eingespeist, sondern erst beim Speichern als Quellenliste des Artikels verwendet - der Artikeltext selbst entsteht aus den englischen Original-Snippets.",
      },
      {
        type: "prompt",
        label: "Artikel erstellen",
        promptKey: "article-writer",
        description: "Schreibt den vollstaendigen deutschen Artikel aus Original-Text plus Recherche, im Stil des beim Scan zugewiesenen Autoren-Profils. Timeout: 10 Minuten (konfigurierbar ueber ARTICLE_GENERATION_TIMEOUT_MS).",
        note: "Schlaegt dieser Schritt fehl (Timeout, LM-Studio-Fehler), wird das als GENERATION_FAILED protokolliert. Der Zaehler fuer aufeinanderfolgende Fehlschlaege ist dauerhaft gespeichert (RadarSettings.consecutiveFailures), nicht nur im Arbeitsspeicher eines Laufs - nach 3 in Folge reiht der Scan-Schritt keine neuen Artikel mehr ein (Sicherheitsabbruch), bis ein Erfolg oder ein manuelles Zuruecksetzen den Zaehler leert.",
      },
      {
        type: "action",
        label: "Artikel speichern",
        description: "Speichert den Artikel mit Status REVIEW oder PUBLISHED bei Erfolg (je nach Radar-Einstellung \"Direkt veroeffentlichen\"), oder FAILED wenn die Generierung fehlgeschlagen ist (siehe Duplikat-Check im Scan-Schritt fuer die Retry-Logik dahinter).",
      },
    ],
  },
  {
    key: "research-job",
    label: "Recherche-Job (Ad-hoc-Thema)",
    summary:
      "Schreibt einen einzelnen Artikel zu einem frei gewaehlten oder aus den Hot Topics uebernommenen Thema - unabhaengig vom Radar.",
    trigger:
      "Manuell ausgeloest: \"Artikel erstellen\" auf einem Eintrag im Hot-Topics-Radar (Research-Panel), oder ein frei eingegebenes Thema. Laeuft in derselben globalen Warteschlange wie Radar-Artikel - wird sofort mit einer klaren Fehlermeldung abgelehnt, falls gerade ein anderer Job aktiv ist, statt zu warten.",
    steps: [
      {
        type: "decision",
        label: "Duplikat-Check",
        description: "Exakter oder semantischer Treffer auf Titel/URL gegen bestehende Artikel und bereits laufende Auftraege.",
        note: "Ein exakter Treffer bricht den Dispatch ab (ausser bei erzwungenem \"force\"-Dispatch). Ein rein semantischer Treffer wird im Research-Panel nur als Hinweis angezeigt, blockiert aber nicht.",
      },
      {
        type: "prompt",
        label: "Autor finden",
        promptKey: "author-topic-match",
        description: "Bestimmt anhand von Bio, Tonalitaet und Sonderregeln aller aktiven Autoren, wer inhaltlich am besten zum Thema passt.",
        note: "Wird uebersprungen, wenn beim Dispatch bereits explizit ein Autor ausgewaehlt wurde.",
      },
      {
        type: "action",
        label: "Web-Recherche",
        description: "Sucht externe Quellen zum Thema (Brave Search / DuckDuckGo / Wikipedia).",
      },
      {
        type: "action",
        label: "Aggregator-Filter",
        description: "Entfernt Treffer von Google Trends, Reddit, TVMaze & Co. aus der Recherche - diese Aggregator-Seiten sollen nie selbst als \"Artikel-Original\" verwendet werden.",
      },
      {
        type: "prompt",
        label: "Artikel erstellen",
        promptKey: "article-writer",
        description: "Schreibt den Artikel aus dem Thema plus gefilterter Recherche (Original-Snippets und bis zu drei abgerufenen Volltexten).",
      },
      {
        type: "prompt",
        label: "Zitate uebersetzen",
        promptKey: "citation-translator",
        description: "Uebersetzt die Recherche-Quellen fuer die gespeicherte Quellenliste des fertigen Artikels.",
      },
      {
        type: "action",
        label: "Artikel speichern",
        description: "Speichert den Artikel mit Status REVIEW oder PUBLISHED.",
      },
    ],
  },
  {
    key: "hot-topics-scan",
    label: "Hot-Topics-Scan",
    summary:
      "Sammelt und bewertet Trend-Themen aus vielen freien Quellen fuer das Research-Panel - die Basis, aus der heraus Recherche-Jobs dispatcht werden.",
    trigger:
      "Manuell per \"Aktualisieren\" im Research-Panel ausgeloest, oder automatisch beim ersten Laden, wenn noch kein aktueller Snapshot existiert. Laeuft nie zweimal gleichzeitig fuer dieselbe Fokus-Kombination - ein bereits laufender Scan wird von allen offenen Tabs/Polls geteilt.",
    steps: [
      {
        type: "action",
        label: "Themen sammeln",
        description: "Sammelt parallel aus bis zu zehn kostenlosen Quellen (Variety, Deadline, THR, Collider, Screen Rant, TMZ, Google News, Reddit, TVMaze, Hacker News) und gruppiert aehnliche Meldungen zu Trend-Events.",
      },
      {
        type: "prompt",
        label: "KI-Relevanz-Filter",
        promptKey: "hot-topics-filter",
        description: "Bewertet jedes Trend-Event auf Relevanz zum konfigurierten Fokusgebiet, vergibt Kategorie, Relevanz-Score und extrahiert Personen/Werke/Studios.",
        note: "Bei Timeout, Fehler oder leerer KI-Antwort: automatischer Fallback auf reinen Keyword-Abgleich ohne KI-Aufruf.",
      },
      {
        type: "prompt",
        label: "Hot-Topics uebersetzen",
        promptKey: "hot-topics-de-translator",
        description: "Erzeugt eine deutsche Fassung von Titel und Begruendung fuer alle Themen, die noch keine haben.",
        note: "Interner Teilschritt des KI-Relevanz-Filters - laeuft sowohl fuer das KI-Ergebnis als auch fuer den Keyword-Fallback.",
      },
      {
        type: "prompt",
        label: "Autor-Zuordnung",
        promptKey: "author-topic-match",
        description: "Weist jedem gefilterten Thema den am besten passenden Autor aus dem aktiven Autoren-Stack zu, inklusive kurzer Begruendung.",
      },
      {
        type: "decision",
        label: "Semantischer Duplikat-Check",
        description: "Vergleicht jedes Thema per Embeddings gegen kuerzlich erstellte Artikel und laufende Auftraege.",
        note: "Markiert moegliche Duplikate nur zur Anzeige im Research-Panel - entfernt sie nicht aus der Liste.",
      },
      {
        type: "action",
        label: "Snapshot speichern",
        description: "Ergebnis wird als Snapshot in der Datenbank abgelegt und bei jedem weiteren Seitenaufruf/Poll direkt ausgeliefert, ohne erneut zu rechnen.",
      },
    ],
  },
  {
    key: "newsletter-dispatch",
    label: "Newsletter-Versand",
    summary:
      "Stellt eine konkrete Newsletter-Ausgabe aus dem aktuellen Artikel-Pool zusammen und verschickt sie per E-Mail.",
    trigger:
      "Automatisch: ein Scheduler prueft alle 60 Sekunden, ob der naechste geplante Sendezeitpunkt eines aktiven Newsletters erreicht ist. Manuell: \"Jetzt an Empfaenger senden\" oder \"Test-Mail\" im Newsletter-Editor.",
    steps: [
      {
        type: "action",
        label: "Artikel-Pool laden",
        description: "Laedt Artikel aus dem Zeitraum der jeweiligen Frequenz (letzte 24 Std. / 7 Tage / 30 Tage) mit Status REVIEW oder PUBLISHED, sortiert nach Qualitaets-Score.",
      },
      {
        type: "prompt",
        label: "KI-Kuratierung",
        promptKey: "newsletter-curation",
        description: "Waehlt aus dem Pool die interessantesten Artikel aus (Themenvielfalt statt nur Score), ordnet sie nach Relevanz und schreibt die einleitende Editorial-Zusammenfassung.",
        note: "Laeuft nur beim tatsaechlichen Versand. Die schnelle Vorschau in der Newsletter-Liste nutzt bewusst KEINE KI, damit die Seite schnell laedt.",
      },
      {
        type: "action",
        label: "HTML rendern",
        description: "Baut die responsive E-Mail (Inline-Styles, Darkmode-Block) aus den kuratierten Artikeln und der Editorial-Einleitung.",
      },
      {
        type: "action",
        label: "Versand per SMTP",
        description: "Verschickt die Mail an alle konfigurierten Empfaenger (bzw. die Test-Adresse) und protokolliert Erfolg oder Fehler.",
      },
    ],
  },
  {
    key: "filmradar-comparison",
    label: "FILMRADAR-Abgleich",
    summary:
      "Vergleicht die offizielle Verleiher-Filmstartliste (VDF, via allscreens.de) mit der Redaktionsliste im Spielfilm.de-CMS und markiert fehlende Titel, sortiert nach geschaetztem Zugriffspotential.",
    trigger:
      "Automatisch alle paar Stunden (Standard: 4h) ueber den Scheduler, oder manuell per \"Jetzt aktualisieren\" auf der FILMRADAR-Seite. Enthaelt KEINEN KI-Prompt - reine Scrapes plus die kostenlose OMDb-API fuer Wertungen.",
    steps: [
      {
        type: "action",
        label: "VDF-Liste laden",
        description: "Scrapt allscreens.de/filmstarts - eine Tabelle pro Startdatum mit Filmtitel und Verleih/Vertrieb.",
      },
      {
        type: "action",
        label: "Spielfilm.de-Liste laden",
        description: "Loggt sich mit den konfigurierten Zugangsdaten ins Spielfilm.de-CMS ein und liest die dortige Redaktions-Filmliste (Titel, Datum, Teaser, oeffentliche Artikel-URL) aus.",
        note: "Sitzung wird zwischen Laeufen wiederverwendet, solange sie gueltig ist - kein Login bei jedem einzelnen Request.",
      },
      {
        type: "decision",
        label: "Titel abgleichen",
        description: "Gleicht jeden VDF-Titel gegen die Spielfilm.de-Liste ab: exakte oder Wortueberlappung im Titel UND Startdatum innerhalb von 14 Tagen. Kein Treffer -> als fehlend markiert.",
        note: "Reine Textualgleichung, kein KI-Prompt - zwei Seiten formatieren denselben Titel oft unterschiedlich (z.B. Formatzusatz vs. Untertitel), daher Wortueberlappung statt strikter Gleichheit.",
      },
      {
        type: "action",
        label: "Zugriffspotential schaetzen",
        description: "Fuer fehlende Titel der naechsten zwei Startwochen: IMDb- und Rotten-Tomatoes-Wertung ueber die kostenlose OMDb-API abrufen und zu einem 0-100-Score kombinieren.",
        note: "Nur mit konfiguriertem OMDB_API_KEY. Direktes Scraping von IMDb und die Google-Trends-API sind beide durch Bot-Erkennung blockiert - echter Social-Media-Buzz (Facebook/Instagram/TikTok/X/Bluesky) ist ohne bezahlte Plattform-Zugaenge nicht verfuegbar und daher bewusst nicht enthalten.",
      },
      {
        type: "action",
        label: "Snapshot speichern",
        description: "Ergebnis wird als Snapshot in der Datenbank abgelegt - die FILMRADAR-Seite liest immer den neuesten Snapshot statt bei jedem Seitenaufruf neu zu rechnen.",
      },
    ],
  },
];

import axios from 'axios';
import { generateText } from 'ai';
import { fetchRSS } from '@/lib/fetcher';
import { buildResearchEngineFilterPrompt, buildAuthorMatchPrompt } from '@/lib/research-engine-prompt';
import { ensureGermanHotTopics } from '@/lib/ai';
import { resolvePrimaryModel } from '@/lib/llm-settings';

export type SourceKind =
  | 'rss'
  | 'reddit'
  | 'google-trends'
  | 'hackernews'
  | 'tvmaze-schedule';

export type SourceDescriptor = {
  id: string;
  name: string;
  kind: SourceKind;
  weight: number;
  url?: string;
  sub?: string;
};

export type RawTopic = {
  title: string;
  url: string;
  source: SourceDescriptor;
  publishedAt: Date;
  engagement: number;
};

export type SourceMixEntry = {
  id: string;
  name: string;
  count: number;
  weight: number;
};

export type HotTopic = {
  key: string;
  title: string;
  url: string;
  trendScore: number;
  velocityScore: number;
  freshnessScore: number;
  engagementScore: number;
  sourceWeightScore: number;
  sourceCount: number;
  sources: string[];
  sourceMix: SourceMixEntry[];
  publishedAt: string;
};

export type Entities = {
  persons: string[];
  works: string[];
  studios: string[];
};

export type FilteredHotTopic = HotTopic & {
  matchedThemes: string[];
  aiRelevance: number;
  aiReason: string;
  category: string;
  entities: Entities;
  titleDe?: string;
  reasonDe?: string;
};

type FilterOptions = {
  primaryDomain?: string;
  domainTaxonomy?: string[];
};

type CollectOptions = {
  limit?: number;
  preset?: string;
};

// Alle Quellen sind 100% kostenlos und benoetigen keinen API-Key.
// Bezahlte Anbieter (TMDB Enterprise, Serper, Tavily, Bing News, NewsAPI, ...)
// sind bewusst nicht enthalten.
const SOURCE_PRESETS: Record<string, SourceDescriptor[]> = {
  entertainment: [
    { id: 'variety', name: 'Variety', kind: 'rss', weight: 0.95, url: 'https://variety.com/feed/' },
    { id: 'deadline', name: 'Deadline', kind: 'rss', weight: 0.95, url: 'https://deadline.com/feed/' },
    { id: 'thr', name: 'The Hollywood Reporter', kind: 'rss', weight: 0.9, url: 'https://www.hollywoodreporter.com/feed/' },
    { id: 'collider', name: 'Collider', kind: 'rss', weight: 0.7, url: 'https://collider.com/feed/' },
    { id: 'screenrant', name: 'Screen Rant', kind: 'rss', weight: 0.55, url: 'https://screenrant.com/feed/' },
    { id: 'tmz', name: 'TMZ', kind: 'rss', weight: 0.5, url: 'https://www.tmz.com/rss.xml' },
    { id: 'gnews-film-de', name: 'Google News Film DE', kind: 'rss', weight: 0.7, url: 'https://news.google.com/rss/search?q=film+OR+kino&hl=de&gl=DE&ceid=DE:de' },
    { id: 'gnews-serien-de', name: 'Google News Serien DE', kind: 'rss', weight: 0.7, url: 'https://news.google.com/rss/search?q=serie+OR+netflix+OR+prime+video&hl=de&gl=DE&ceid=DE:de' },
    { id: 'gnews-promi-de', name: 'Google News Promis DE', kind: 'rss', weight: 0.6, url: 'https://news.google.com/rss/search?q=promis+OR+stars+OR+skandal&hl=de&gl=DE&ceid=DE:de' },
    { id: 'gnews-movies-en', name: 'Google News Movies EN', kind: 'rss', weight: 0.65, url: 'https://news.google.com/rss/search?q=movie+OR+film+OR+box+office&hl=en-US&gl=US&ceid=US:en' },
    { id: 'reddit-movies', name: 'Reddit /r/movies', kind: 'reddit', weight: 0.5, sub: 'movies' },
    { id: 'reddit-television', name: 'Reddit /r/television', kind: 'reddit', weight: 0.5, sub: 'television' },
    { id: 'reddit-popculture', name: 'Reddit /r/PopCultureChat', kind: 'reddit', weight: 0.45, sub: 'popculturechat' },
    { id: 'reddit-entertainment', name: 'Reddit /r/Entertainment', kind: 'reddit', weight: 0.4, sub: 'entertainment' },
    { id: 'reddit-boxoffice', name: 'Reddit /r/BoxOffice', kind: 'reddit', weight: 0.5, sub: 'boxoffice' },
    { id: 'tvmaze-schedule', name: 'TVMaze Schedule', kind: 'tvmaze-schedule', weight: 0.7 },
  ],
  general: [
    { id: 'google-trends', name: 'Google Trends', kind: 'google-trends', weight: 0.6 },
    { id: 'gnews-top-de', name: 'Google News Top DE', kind: 'rss', weight: 0.65, url: 'https://news.google.com/rss?hl=de&gl=DE&ceid=DE:de' },
    { id: 'reddit-news', name: 'Reddit /r/news', kind: 'reddit', weight: 0.55, sub: 'news' },
    { id: 'hackernews', name: 'Hacker News', kind: 'hackernews', weight: 0.6 },
  ],
};

function normalizeTopicKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJsonObject(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inside = fenceMatch[1].trim();
    const start = inside.indexOf('{');
    const end = inside.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return inside.slice(start, end + 1);
    }
  }

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || first >= last) return null;
  return text.slice(first, last + 1);
}

const STOPWORDS_TITLE = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'their', 'about',
  'new', 'says', 'will', 'has', 'have', 'why', 'how', 'what', 'when',
  'die', 'der', 'das', 'und', 'oder', 'wird', 'ist', 'ein', 'eine',
  'wegen', 'ueber', 'nach', 'vor', 'zum', 'zur', 'sein', 'seiner',
]);

function extractProperNouns(title: string): string[] {
  const tokens = title
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const proper: string[] = [];
  for (const token of tokens) {
    if (token.length < 3) continue;
    const lower = token.toLowerCase();
    if (STOPWORDS_TITLE.has(lower)) continue;
    if (/^\p{Lu}/u.test(token)) {
      proper.push(lower);
    }
  }

  return Array.from(new Set(proper)).slice(0, 3);
}

function buildClusterSignature(title: string): string {
  const proper = extractProperNouns(title);
  if (proper.length >= 2) {
    return proper.sort().join('|');
  }
  return normalizeTopicKey(title);
}

const CATEGORY_HEURISTICS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Casting & Announcement',
    pattern: /\b(cast|casts|casting|casted|announce|announces|announced|announcement|joins|added to|to star|besetzt|besetzung|neue rolle|debut|deb[uü]t|reveal(s|ed)?|unveil(s|ed)?)\b/i,
  },
  {
    label: 'Season Renewal / Cancellation',
    pattern: /\b(renewed|renewal|cancelled|canceled|cancellation|season\s?\d|final season|staffel|fortsetzung|abgesetzt|verl[aä]ngert|ended|ende)\b/i,
  },
  {
    label: 'Personal / Lifestyle',
    pattern: /\b(baby|newborn|welcomes?|welcomed|engaged|engagement|married|marries|wedding|divorce|hochzeit|verlobt|verlobung|scheidung|schwanger|dating|beziehung)\b/i,
  },
  {
    label: 'Controversy / Scandal',
    pattern: /\b(scandal|controversy|controversial|sues|sued|arrest(ed)?|allegation(s)?|apology|slammed|skandal|streit|klage|verhaftet|kritik|kritisiert|shitstorm|drama|feud)\b/i,
  },
  {
    label: 'General News / Reviews',
    pattern: /\b(review(s|ed)?|interview|premiere|trailer|releases?|released|opens|earnings|box\s?office|kritik|erschienen|kinostart)\b/i,
  },
];

function heuristicCategorize(title: string, taxonomy: string[]): string {
  const available = new Set(taxonomy);
  for (const rule of CATEGORY_HEURISTICS) {
    if (available.has(rule.label) && rule.pattern.test(title)) return rule.label;
  }
  if (available.has('General News / Reviews')) return 'General News / Reviews';
  return taxonomy.includes('Other') ? 'Other' : taxonomy[0] || 'Other';
}

function heuristicEntities(title: string): Entities {
  const proper = extractProperNouns(title).map((token) => token.charAt(0).toUpperCase() + token.slice(1));
  return { persons: proper.slice(0, 3), works: [], studios: [] };
}

async function fetchRssFeed(source: SourceDescriptor, limit: number): Promise<RawTopic[]> {
  if (!source.url) return [];
  const items = await fetchRSS(source.url);
  return items.slice(0, limit).map((item) => ({
    title: item.title,
    url: item.link,
    source,
    publishedAt: item.pubDate || new Date(),
    engagement: 50,
  }));
}

async function fetchSubreddit(source: SourceDescriptor, limit: number): Promise<RawTopic[]> {
  const sub = source.sub || 'news';
  const response = await axios.get(`https://www.reddit.com/r/${sub}/hot.json`, {
    params: { limit: Math.min(50, Math.max(10, limit)) },
    timeout: 15000,
    headers: { 'User-Agent': 'NewsPublisherBot/1.0' },
  });

  const children = Array.isArray(response.data?.data?.children) ? response.data.data.children : [];
  return children.slice(0, limit).map((entry: any) => {
    const data = entry?.data || {};
    const score = Number(data.score) || 0;
    const comments = Number(data.num_comments) || 0;
    const combined = score + comments * 2;
    const engagement = Math.max(0, Math.min(100, Math.round((combined / 4000) * 100)));

    return {
      title: String(data.title || '').trim(),
      url: data.url ? String(data.url) : `https://reddit.com${data.permalink || ''}`,
      source,
      publishedAt: Number.isFinite(data.created_utc)
        ? new Date(Number(data.created_utc) * 1000)
        : new Date(),
      engagement,
    };
  }).filter((item: RawTopic) => item.title && item.url);
}

async function fetchGoogleTrends(source: SourceDescriptor, limit: number): Promise<RawTopic[]> {
  const items = await fetchRSS('https://trends.google.com/trending/rss?geo=US');
  return items.slice(0, limit).map((item) => ({
    title: item.title,
    url: item.link,
    source,
    publishedAt: item.pubDate || new Date(),
    engagement: 60,
  }));
}

async function fetchHackerNews(source: SourceDescriptor, limit: number): Promise<RawTopic[]> {
  const topRes = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', { timeout: 15000 });
  const ids: number[] = Array.isArray(topRes.data) ? topRes.data.slice(0, limit) : [];
  const items = await Promise.all(
    ids.map(async (id) => {
      try {
        const itemRes = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 15000 });
        const item = itemRes.data;
        const score = Number(item?.score) || 0;
        const engagement = Math.max(0, Math.min(100, Math.round((score / 800) * 100)));

        return {
          title: String(item?.title || '').trim(),
          url: String(item?.url || `https://news.ycombinator.com/item?id=${id}`),
          source,
          publishedAt: Number.isFinite(item?.time) ? new Date(Number(item.time) * 1000) : new Date(),
          engagement,
        } as RawTopic;
      } catch {
        return null;
      }
    })
  );

  return items.filter((item): item is RawTopic => Boolean(item && item.title && item.url));
}

async function fetchTVMazeSchedule(source: SourceDescriptor, limit: number): Promise<RawTopic[]> {
  const response = await axios.get('https://api.tvmaze.com/schedule', {
    params: { country: 'US' },
    timeout: 15000,
  });

  const entries = Array.isArray(response.data) ? response.data : [];
  return entries.slice(0, limit).map((entry: any) => {
    const showName = String(entry?.show?.name || '').trim();
    const episodeName = String(entry?.name || '').trim();
    const title = episodeName ? `${showName} - ${episodeName}` : showName;
    const url = String(entry?.show?.url || entry?.url || 'https://www.tvmaze.com');
    const airdate = entry?.airdate ? new Date(entry.airdate) : new Date();
    return { title, url, source, publishedAt: airdate, engagement: 60 } as RawTopic;
  }).filter((item: RawTopic) => item.title && item.url);
}

async function fetchFromSource(source: SourceDescriptor, perSource: number): Promise<RawTopic[]> {
  switch (source.kind) {
    case 'rss':
      return fetchRssFeed(source, perSource);
    case 'reddit':
      return fetchSubreddit(source, perSource);
    case 'google-trends':
      return fetchGoogleTrends(source, perSource);
    case 'hackernews':
      return fetchHackerNews(source, perSource);
    case 'tvmaze-schedule':
      return fetchTVMazeSchedule(source, perSource);
    default:
      return [];
  }
}

function computeScores(cluster: RawTopic[]) {
  const now = Date.now();
  const uniqueSourceIds = new Set(cluster.map((entry) => entry.source.id));
  const uniqueSources = uniqueSourceIds.size;

  const latest = cluster.reduce((max, entry) => Math.max(max, entry.publishedAt.getTime()), 0);
  const hoursSinceLatest = Math.max(0, (now - latest) / (1000 * 60 * 60));
  const freshnessScore = Math.max(0, Math.min(100, Math.round(100 - hoursSinceLatest * 3)));

  const velocityScore = Math.max(0, Math.min(100, Math.round(uniqueSources * 25)));

  const avgWeight = cluster.reduce((sum, entry) => sum + entry.source.weight, 0) / cluster.length;
  const sourceWeightScore = Math.max(0, Math.min(100, Math.round(avgWeight * 100)));

  const avgEngagement = cluster.reduce((sum, entry) => sum + entry.engagement, 0) / cluster.length;
  const engagementScore = Math.max(0, Math.min(100, Math.round(avgEngagement)));

  const trendScore = Math.round(
    0.35 * velocityScore +
    0.25 * freshnessScore +
    0.25 * sourceWeightScore +
    0.15 * engagementScore
  );

  return {
    trendScore: Math.max(0, Math.min(100, trendScore)),
    velocityScore,
    freshnessScore,
    engagementScore,
    sourceWeightScore,
  };
}

function pickPreset(name?: string | null): SourceDescriptor[] {
  const key = String(name || process.env.RESEARCH_SOURCE_PRESET || 'entertainment').toLowerCase().trim();
  return SOURCE_PRESETS[key] || SOURCE_PRESETS.entertainment;
}

export async function collectHotTopics(options: number | CollectOptions = 20): Promise<HotTopic[]> {
  const limit = typeof options === 'number' ? options : options.limit ?? 20;
  const preset = typeof options === 'number' ? undefined : options.preset;
  const perSource = Math.max(6, Math.min(20, Math.round(limit)));

  const sources = pickPreset(preset);

  const settled = await Promise.allSettled(sources.map((source) => fetchFromSource(source, perSource)));

  const allTopics: RawTopic[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') allTopics.push(...result.value);
  }

  const grouped = new Map<string, RawTopic[]>();
  for (const topic of allTopics) {
    if (!topic.title || !topic.url) continue;
    const signature = buildClusterSignature(topic.title);
    if (!signature) continue;
    const group = grouped.get(signature) || [];
    group.push(topic);
    grouped.set(signature, group);
  }

  const merged: HotTopic[] = Array.from(grouped.entries()).map(([signature, group]) => {
    const sortedByRank = [...group].sort((a, b) => {
      const weightDelta = b.source.weight - a.source.weight;
      if (weightDelta !== 0) return weightDelta;
      return b.engagement - a.engagement;
    });
    const primary = sortedByRank[0];
    const sourceNames = Array.from(new Set(group.map((entry) => entry.source.name)));
    const uniqueSourceIds = new Set(group.map((entry) => entry.source.id));

    const sourceMix: SourceMixEntry[] = [];
    for (const id of uniqueSourceIds) {
      const items = group.filter((entry) => entry.source.id === id);
      const first = items[0]?.source;
      if (!first) continue;
      sourceMix.push({ id: first.id, name: first.name, count: items.length, weight: first.weight });
    }

    const scores = computeScores(group);

    return {
      key: signature,
      title: primary.title,
      url: primary.url,
      trendScore: scores.trendScore,
      velocityScore: scores.velocityScore,
      freshnessScore: scores.freshnessScore,
      engagementScore: scores.engagementScore,
      sourceWeightScore: scores.sourceWeightScore,
      sourceCount: sourceNames.length,
      sources: sourceNames,
      sourceMix,
      publishedAt: primary.publishedAt.toISOString(),
    };
  });

  return merged
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit);
}

export function parseFocusThemes(input?: string | null): string[] {
  const fromInput = String(input || '').trim();
  const fromEnv = String(process.env.RESEARCH_FOCUS_TOPICS || '').trim();
  const raw = fromInput || fromEnv || 'casting,staffel,scandal,box-office,serie,film';

  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function keywordFilter(topics: HotTopic[], focusThemes: string[], taxonomy: string[] = ['Other']): FilteredHotTopic[] {
  if (focusThemes.length === 0) {
    return topics.map((topic) => ({
      ...topic,
      matchedThemes: [],
      aiRelevance: 75,
      aiReason: 'Kein Fokus gesetzt. Topic wurde standardmaessig zugelassen.',
      category: heuristicCategorize(topic.title, taxonomy),
      entities: heuristicEntities(topic.title),
    }));
  }

  const normalizedThemes = focusThemes.map((theme) => normalizeTopicKey(theme));
  const filtered: FilteredHotTopic[] = [];

  for (const topic of topics) {
    const normalizedTitle = normalizeTopicKey(topic.title);
    const matchedThemes = normalizedThemes
      .map((theme, idx) => (theme && normalizedTitle.includes(theme) ? focusThemes[idx] : null))
      .filter((v): v is string => Boolean(v));

    if (matchedThemes.length === 0) continue;

    filtered.push({
      ...topic,
      matchedThemes,
      aiRelevance: Math.min(100, 60 + matchedThemes.length * 20),
      aiReason: 'Keyword-Match auf Fokus-Themen (Fallback ohne KI-Antwort).',
      category: heuristicCategorize(topic.title, taxonomy),
      entities: heuristicEntities(topic.title),
    });
  }

  return filtered;
}

export type FilterHotTopicsResult = {
  topics: FilteredHotTopic[];
  diagnostics: {
    usedAI: boolean;
    aiDurationMs: number | null;
    aiRawLength: number | null;
    aiIncluded: number;
    aiRejected: number;
    aiError: string | null;
    fallbackReason: string | null;
    focusThemes: string[];
    taxonomy: string[];
    inputTopics: number;
  };
};

export async function filterHotTopicsWithAI(
  topics: HotTopic[],
  focusThemes: string[],
  options?: FilterOptions
): Promise<FilterHotTopicsResult> {
  if (topics.length === 0) {
    return {
      topics: [],
      diagnostics: {
        usedAI: false,
        aiDurationMs: null,
        aiRawLength: null,
        aiIncluded: 0,
        aiRejected: 0,
        aiError: null,
        fallbackReason: 'no-input-topics',
        focusThemes,
        taxonomy: [],
        inputTopics: 0,
      },
    };
  }

  const domainTaxonomy = Array.isArray(options?.domainTaxonomy) && options.domainTaxonomy.length > 0
    ? options.domainTaxonomy
    : [
        'Casting & Announcement',
        'Season Renewal / Cancellation',
        'Personal / Lifestyle',
        'Controversy / Scandal',
        'General News / Reviews',
        'Other',
      ];

  if (focusThemes.length === 0) {
    const noFocusTopics: FilteredHotTopic[] = topics.map((topic) => ({
      ...topic,
      matchedThemes: [],
      aiRelevance: 80,
      aiReason: 'Kein Fokus gesetzt. Topic wurde von der KI pauschal zugelassen.',
      category: heuristicCategorize(topic.title, domainTaxonomy),
      entities: heuristicEntities(topic.title),
    }));
    return {
      topics: noFocusTopics,
      diagnostics: {
        usedAI: false,
        aiDurationMs: null,
        aiRawLength: null,
        aiIncluded: noFocusTopics.length,
        aiRejected: 0,
        aiError: null,
        fallbackReason: 'no-focus-themes',
        focusThemes,
        taxonomy: domainTaxonomy,
        inputTopics: topics.length,
      },
    };
  }

  const timeoutMs = Math.max(15000, Number(process.env.RESEARCH_AI_TIMEOUT_MS || 1800000));
  const startedAt = Date.now();
  let rawText = '';
  const model = await resolvePrimaryModel();

  console.log('[research-ai] start', {
    topics: topics.length,
    focusThemes,
    taxonomy: domainTaxonomy,
    timeoutMs,
    model: model.modelId,
  });

  try {
    const input = topics.map((topic) => ({ key: topic.key, title: topic.title }));
    const primaryDomain = (options?.primaryDomain || process.env.RESEARCH_PRIMARY_DOMAIN || 'Film, Serien, Schauspieler, Promi-News').trim();

    const prompt = await buildResearchEngineFilterPrompt({
      primaryDomain,
      focusThemes,
      domainTaxonomy,
      topics: input,
    });

    const aiResponse = await Promise.race([
      generateText({
        model,
        prompt,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI_FILTER_TIMEOUT')), timeoutMs);
      }),
    ]);

    const { text } = aiResponse;
    rawText = text || '';

    console.log('[research-ai] response received', {
      durationMs: Date.now() - startedAt,
      textLength: rawText.length,
    });

    const jsonText = extractJsonObject(rawText);
    if (!jsonText) {
      const fallback = keywordFilter(topics, focusThemes, domainTaxonomy);
      console.warn('[research-ai] no JSON in response, fallback to keyword filter', { included: fallback.length });
      return {
        topics: fallback,
        diagnostics: {
          usedAI: false,
          aiDurationMs: Date.now() - startedAt,
          aiRawLength: rawText.length,
          aiIncluded: 0,
          aiRejected: 0,
          aiError: 'no-json-in-response',
          fallbackReason: 'ai-no-json',
          focusThemes,
          taxonomy: domainTaxonomy,
          inputTopics: topics.length,
        },
      };
    }

    const parsed = JSON.parse(jsonText) as {
      items?: Array<{
        key?: string;
        include?: boolean;
        relevance?: number;
        matchedThemes?: string[];
        category?: string;
        reason?: string;
        titleDe?: string;
        reasonDe?: string;
        entities?: {
          persons?: string[];
          works?: string[];
          studios?: string[];
        };
      }>;
    };

    const byKey = new Map((parsed.items || []).map((item) => [String(item.key || ''), item]));

    const filtered: FilteredHotTopic[] = [];

    for (const topic of topics) {
      const decision = byKey.get(topic.key);
      if (!decision?.include) continue;

      const relevance = Number.isFinite(decision.relevance) ? Math.max(0, Math.min(100, Number(decision.relevance))) : 70;
      if (relevance < 65) continue;

      const matchedThemes = Array.isArray(decision.matchedThemes)
        ? decision.matchedThemes
            .map((theme) => String(theme).trim().toLowerCase())
            .filter((theme) => focusThemes.includes(theme))
        : [];

      const entities: Entities = {
        persons: Array.isArray(decision.entities?.persons)
          ? decision.entities.persons.map((v) => String(v).trim()).filter(Boolean).slice(0, 5)
          : [],
        works: Array.isArray(decision.entities?.works)
          ? decision.entities.works.map((v) => String(v).trim()).filter(Boolean).slice(0, 5)
          : [],
        studios: Array.isArray(decision.entities?.studios)
          ? decision.entities.studios.map((v) => String(v).trim()).filter(Boolean).slice(0, 5)
          : [],
      };

      const heuristicFallback = heuristicEntities(topic.title);
      if (entities.persons.length === 0) entities.persons = heuristicFallback.persons;

      const rawCategory = String(decision.category || '').trim();
      const category = rawCategory && rawCategory !== 'Other'
        ? rawCategory
        : heuristicCategorize(topic.title, domainTaxonomy);

      filtered.push({
        ...topic,
        matchedThemes,
        aiRelevance: relevance,
        category,
        aiReason: String(decision.reason || '').trim() || 'Von der KI als passend eingestuft.',
        entities,
        titleDe: String(decision.titleDe || '').trim() || undefined,
        reasonDe: String(decision.reasonDe || '').trim() || undefined,
      });
    }

    if (filtered.length > 0) {
      const withGerman = await ensureGermanHotTopics(filtered);
      console.log('[research-ai] used AI result', { included: withGerman.length, rejected: topics.length - withGerman.length });
      return {
        topics: withGerman.sort((a, b) => b.aiRelevance - a.aiRelevance || b.trendScore - a.trendScore),
        diagnostics: {
          usedAI: true,
          aiDurationMs: Date.now() - startedAt,
          aiRawLength: rawText.length,
          aiIncluded: withGerman.length,
          aiRejected: topics.length - withGerman.length,
          aiError: null,
          fallbackReason: null,
          focusThemes,
          taxonomy: domainTaxonomy,
          inputTopics: topics.length,
        },
      };
    }

    const fallbackTopics = keywordFilter(topics, focusThemes, domainTaxonomy);
    const fallbackTopicsDe = await ensureGermanHotTopics(fallbackTopics);
    console.warn('[research-ai] AI returned no items, fallback to keyword filter', { included: fallbackTopicsDe.length });
    return {
      topics: fallbackTopicsDe,
      diagnostics: {
        usedAI: false,
        aiDurationMs: Date.now() - startedAt,
        aiRawLength: rawText.length,
        aiIncluded: 0,
        aiRejected: topics.length,
        aiError: 'ai-empty-result',
        fallbackReason: 'ai-no-items',
        focusThemes,
        taxonomy: domainTaxonomy,
        inputTopics: topics.length,
      },
    };
  } catch (error: any) {
    const message = error?.message || 'unknown';
    console.error('[research-ai] error, fallback to keyword filter', { message, durationMs: Date.now() - startedAt });
    const fallbackTopics = keywordFilter(topics, focusThemes, domainTaxonomy);
    const fallbackTopicsDe = await ensureGermanHotTopics(fallbackTopics);
    return {
      topics: fallbackTopicsDe,
      diagnostics: {
        usedAI: false,
        aiDurationMs: Date.now() - startedAt,
        aiRawLength: rawText.length || null,
        aiIncluded: 0,
        aiRejected: 0,
        aiError: message,
        fallbackReason: message === 'AI_FILTER_TIMEOUT' ? 'ai-timeout' : 'ai-exception',
        focusThemes,
        taxonomy: domainTaxonomy,
        inputTopics: topics.length,
      },
    };
  }
}

// Domain-signal words only count when BOTH the topic and the author's own
// profile mention them - otherwise an author whose bio happens to contain one
// of these words (e.g. "Film") would get the same flat bonus on every single
// topic, regardless of subject, and end up winning almost every match.
const DOMAIN_SIGNAL_WORDS = [
  'investigativ', 'analyse', 'daten', 'wirtschaft', 'politik', 'tech', 'digital',
  'film', 'serie', 'hollywood', 'promi', 'breaking', 'viral', 'trend', 'social',
  'casting', 'skandal',
];

// Pure keyword-overlap fallback, used only when AI author-matching
// (matchAuthorsForTopics) is unavailable or fails for a topic.
export function chooseBestAuthorForTopic(
  topic: string,
  authors: Array<{ id: string; name: string; bio: string | null; tone: string; instructions: string | null }>
) {
  const words = topic.toLowerCase().split(/\s+/).filter(Boolean);
  const topicText = words.join(' ');

  let best: { id: string; name: string; score: number; reason: string } | null = null;

  for (const author of authors) {
    const corpus = `${author.name} ${author.bio || ''} ${author.tone || ''} ${author.instructions || ''}`.toLowerCase();
    let score = 0;

    for (const word of words) {
      if (word.length < 4) continue;
      if (corpus.includes(word)) score += 2;
    }

    for (const signal of DOMAIN_SIGNAL_WORDS) {
      if (topicText.includes(signal) && corpus.includes(signal)) score += 3;
    }

    const reason = score > 0
      ? 'Profil und Stil passen zu den Topic-Keywords.'
      : 'Kein direkter Keyword-Match, als neutraler Autor ausgewaehlt.';

    if (!best || score > best.score) {
      best = { id: author.id, name: author.name, score, reason };
    }
  }

  return best;
}

export type AuthorInput = {
  id: string;
  name: string;
  bio: string | null;
  tone: string;
  instructions: string | null;
};

export type AuthorMatch = { id: string; name: string; reason: string };

// AI-based author matching: sends the whole author stack (bio/tone/rules) and
// all topics to the LLM in one call, so it can pick a genuinely different
// author per topic based on who actually fits, instead of the keyword
// heuristic above (kept only as a fallback for when the AI call fails).
export async function matchAuthorsForTopics(
  topics: Array<{ key: string; title: string }>,
  authors: AuthorInput[]
): Promise<Map<string, AuthorMatch>> {
  const result = new Map<string, AuthorMatch>();
  if (topics.length === 0 || authors.length === 0) return result;

  if (authors.length === 1) {
    const only = authors[0];
    for (const topic of topics) {
      result.set(topic.key, { id: only.id, name: only.name, reason: 'Einziger aktiver Autor im Stack.' });
    }
    return result;
  }

  const timeoutMs = Math.max(15000, Number(process.env.RESEARCH_AI_TIMEOUT_MS || 1800000));

  try {
    const prompt = await buildAuthorMatchPrompt({
      authors: authors.map((author) => ({
        id: author.id,
        name: author.name,
        bio: author.bio || '',
        tone: author.tone || '',
        instructions: author.instructions || '',
      })),
      topics,
    });

    const aiResponse = await Promise.race([
      generateText({
        model: await resolvePrimaryModel(),
        prompt,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI_AUTHOR_MATCH_TIMEOUT')), timeoutMs);
      }),
    ]);

    const jsonText = extractJsonObject(aiResponse.text || '');
    if (jsonText) {
      const parsed = JSON.parse(jsonText) as {
        assignments?: Array<{ key?: string; authorId?: string; reason?: string }>;
      };
      const authorById = new Map(authors.map((author) => [author.id, author]));

      for (const item of parsed.assignments || []) {
        const key = String(item?.key || '');
        const author = authorById.get(String(item?.authorId || ''));
        if (!key || !author) continue;
        result.set(key, {
          id: author.id,
          name: author.name,
          reason: String(item?.reason || '').trim() || 'Von der KI als passend eingestuft.',
        });
      }
    }
  } catch (error: any) {
    console.error('[author-match] AI matching failed, using keyword fallback', { message: error?.message });
  }

  // Fill in anything the AI call didn't cover (timeout, malformed JSON,
  // missing assignment for a specific key) with the keyword heuristic.
  for (const topic of topics) {
    if (result.has(topic.key)) continue;
    const heuristic = chooseBestAuthorForTopic(topic.title, authors);
    if (heuristic) {
      result.set(topic.key, { id: heuristic.id, name: heuristic.name, reason: heuristic.reason });
    }
  }

  return result;
}

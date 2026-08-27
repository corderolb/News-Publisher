import { generateText } from "ai";
import { renderPrompt } from "@/lib/prompts";
import { resolvePrimaryModel } from "@/lib/llm-settings";

export type ResearchItem = {
  title: string;
  url: string;
  snippet: string;
};

export type AuthorStyle = {
  name: string;
  bio?: string | null;
  tone: string;
  instructions?: string | null;
};

export type ScoreBreakdown = {
  factuality: number;
  clarity: number;
  structure: number;
  seo: number;
  explanation: string;
};

export type GeneratedArticlePayload = {
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  keywords: string[];
  qualityScore: number;
  scoreBreakdown: ScoreBreakdown;
  factChecklist: string[];
  followUpAngles: string[];
};

function extractJsonObject(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || first >= last) {
    return null;
  }

  return text.slice(first, last + 1);
}

function toSafePayload(data: Partial<GeneratedArticlePayload>, fallbackTitle: string): GeneratedArticlePayload {
  const breakdownRaw: Partial<ScoreBreakdown> = data.scoreBreakdown || {};
  const rawFactuality = Number(breakdownRaw.factuality);
  const rawClarity = Number(breakdownRaw.clarity);
  const rawStructure = Number(breakdownRaw.structure);
  const rawSeo = Number(breakdownRaw.seo);
  const finiteBreakdown = [rawFactuality, rawClarity, rawStructure, rawSeo].filter((value) => Number.isFinite(value));
  const usesTenScale =
    finiteBreakdown.length === 4 &&
    finiteBreakdown.every((value) => value >= 0 && value <= 10);
  const normalize = (value: number) => (usesTenScale ? value * 10 : value);
  const scoreBreakdown: ScoreBreakdown = {
    factuality: Number.isFinite(rawFactuality) ? Math.max(0, Math.min(100, normalize(rawFactuality))) : 72,
    clarity: Number.isFinite(rawClarity) ? Math.max(0, Math.min(100, normalize(rawClarity))) : 72,
    structure: Number.isFinite(rawStructure) ? Math.max(0, Math.min(100, normalize(rawStructure))) : 72,
    seo: Number.isFinite(rawSeo) ? Math.max(0, Math.min(100, normalize(rawSeo))) : 72,
    explanation: String(breakdownRaw.explanation || "").trim() || "Kein Scoring-Kommentar vorhanden.",
  };

  const inferredScore = Math.round((scoreBreakdown.factuality + scoreBreakdown.clarity + scoreBreakdown.structure + scoreBreakdown.seo) / 4);

  return {
    title: data.title?.trim() || fallbackTitle,
    excerpt: data.excerpt?.trim() || "Kein Teaser vorhanden.",
    body: data.body?.trim() || "Kein Inhalt generiert.",
    seoTitle: data.seoTitle?.trim() || fallbackTitle,
    keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 10).map((k) => String(k).trim()).filter(Boolean) : [],
    qualityScore: Number.isFinite(data.qualityScore)
      ? Math.max(0, Math.min(100, Number(data.qualityScore)))
      : inferredScore,
    scoreBreakdown,
    factChecklist: Array.isArray(data.factChecklist)
      ? data.factChecklist.map((v) => String(v).trim()).filter(Boolean)
      : [],
    followUpAngles: Array.isArray(data.followUpAngles)
      ? data.followUpAngles.map((v) => String(v).trim()).filter(Boolean)
      : [],
  };
}

// No default timeout in the underlying HTTP stack means a hung/overloaded
// LM Studio can block this call indefinitely - a real incident stalled 4
// consecutive pipeline items for ~16 minutes each (65 min total) with no
// error surfaced until something external eventually cut the connection.
// This is the one prompt call in the app that previously had no bound at
// all (the other two in this file already use a 60s AbortController).
const ARTICLE_GENERATION_TIMEOUT_MS = Math.max(30_000, Number(process.env.ARTICLE_GENERATION_TIMEOUT_MS || 600_000));

// Shared by the two translation helpers below (citations, hot-topic titles).
const TRANSLATION_TIMEOUT_MS = 120_000;

// Throws on failure (timeout, network error, malformed model response)
// instead of returning null - callers decide how to handle/log that per
// their own context (pipeline.ts continues to the next candidate,
// research-jobs.ts lets its own outer try/catch fail the single job).
export async function generateArticleWithResearch(params: {
  title: string;
  textContent: string;
  author: AuthorStyle;
  research: ResearchItem[];
}): Promise<GeneratedArticlePayload> {
  const { title, textContent, author, research } = params;

  try {
    const researchBlock = research.length
      ? research
          .map((item, index) => `${index + 1}. ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}`)
          .join("\n\n")
      : "Keine externe Recherche verfügbar.";

    const prompt = await renderPrompt("article-writer", {
      AUTHOR_NAME: author.name,
      AUTHOR_BIO: author.bio || "Nicht angegeben",
      AUTHOR_TONE: author.tone,
      AUTHOR_INSTRUCTIONS: author.instructions || "Keine",
      ORIGINAL_TITLE: title,
      ORIGINAL_TEXT: textContent,
      RESEARCH_BLOCK: researchBlock,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ARTICLE_GENERATION_TIMEOUT_MS);

    const { text } = await generateText({
      model: await resolvePrimaryModel(),
      prompt,
      abortSignal: controller.signal,
      // Full articles (title, excerpt, body, SEO fields, score breakdown,
      // fact checklist, follow-up angles) need real headroom - generous cap,
      // not a tight one.
      maxOutputTokens: 8000,
    }).finally(() => clearTimeout(timer));

    const jsonText = extractJsonObject(text);

    if (!jsonText) {
      return {
        title,
        excerpt: text.slice(0, 220),
        body: text,
        seoTitle: title,
        keywords: [],
        qualityScore: 70,
        scoreBreakdown: {
          factuality: 70,
          clarity: 70,
          structure: 70,
          seo: 70,
          explanation: "Fallback: Modell lieferte kein gueltiges JSON.",
        },
        factChecklist: [],
        followUpAngles: [],
      };
    }

    const parsed = JSON.parse(jsonText) as Partial<GeneratedArticlePayload>;
    return toSafePayload(parsed, title);
  } catch (error) {
    // Rethrown (not swallowed to null) so callers can log the actual reason
    // (timeout, network error, malformed response) instead of a silent,
    // unexplained failure - see pipeline.ts's GENERATION_FAILED handling.
    console.error("Error generating article with research:", error);
    throw error;
  }
}

// Translate an array of citations (title + snippet) into German using LM Studio.
// Falls back to the original English text if translation fails or times out.
export async function translateCitationsToGerman(
  citations: ResearchItem[]
): Promise<ResearchItem[]> {
  if (!Array.isArray(citations) || citations.length === 0) return citations;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

    const input = citations.map((item, index) => ({
      i: index,
      title: item.title,
      snippet: item.snippet,
    }));

    const prompt = await renderPrompt("citation-translator", { INPUT_JSON: JSON.stringify(input) });

    const { text } = await generateText({
      model: await resolvePrimaryModel(),
      abortSignal: controller.signal,
      prompt,
      // Translating a handful of citation title/snippet pairs needs far less
      // room than a full article.
      maxOutputTokens: 2000,
    }).finally(() => clearTimeout(timer));

    const jsonText = extractJsonObject(text);
    if (!jsonText) return citations;

    const parsed = JSON.parse(jsonText) as { items?: Array<{ i: number; title?: string; snippet?: string }> };
    if (!parsed?.items || !Array.isArray(parsed.items)) return citations;

    const byIndex = new Map<number, { title?: string; snippet?: string }>();
    for (const item of parsed.items) {
      if (typeof item?.i === "number") byIndex.set(item.i, { title: item.title, snippet: item.snippet });
    }

    return citations.map((item, index) => {
      const translated = byIndex.get(index);
      return {
        title: (translated?.title || item.title || "").trim() || item.title,
        url: item.url,
        snippet: (translated?.snippet || item.snippet || "").trim() || item.snippet,
      };
    });
  } catch (error) {
    console.error("Error translating citations to German:", error);
    return citations;
  }
}

// Ensure every hot topic has a German titleDe / reasonDe. If some are missing,
// send them as a batch to LM Studio for translation. Never throws.
export async function ensureGermanHotTopics<T extends { title: string; aiReason?: string; titleDe?: string; reasonDe?: string }>(
  topics: T[]
): Promise<T[]> {
  if (!Array.isArray(topics) || topics.length === 0) return topics;

  const missing = topics
    .map((topic, index) => ({ topic, index }))
    .filter((entry) => !entry.topic.titleDe || !entry.topic.reasonDe);

  if (missing.length === 0) return topics;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

    const input = missing.map((entry) => ({
      i: entry.index,
      title: entry.topic.title,
      reason: entry.topic.aiReason || "",
    }));

    const prompt = await renderPrompt("hot-topics-de-translator", { INPUT_JSON: JSON.stringify(input) });

    const { text } = await generateText({
      model: await resolvePrimaryModel(),
      abortSignal: controller.signal,
      prompt,
      // Translating a batch of hot-topic titles/reasons needs far less room
      // than a full article.
      maxOutputTokens: 2000,
    }).finally(() => clearTimeout(timer));

    const jsonText = extractJsonObject(text);
    if (!jsonText) return topics;

    const parsed = JSON.parse(jsonText) as { items?: Array<{ i: number; titleDe?: string; reasonDe?: string }> };
    if (!parsed?.items || !Array.isArray(parsed.items)) return topics;

    const byIndex = new Map<number, { titleDe?: string; reasonDe?: string }>();
    for (const item of parsed.items) {
      if (typeof item?.i === "number") byIndex.set(item.i, { titleDe: item.titleDe, reasonDe: item.reasonDe });
    }

    return topics.map((topic, index) => {
      const translated = byIndex.get(index);
      if (!translated) return topic;
      return {
        ...topic,
        titleDe: (topic.titleDe && topic.titleDe.trim()) || (translated.titleDe || "").trim() || topic.titleDe,
        reasonDe: (topic.reasonDe && topic.reasonDe.trim()) || (translated.reasonDe || "").trim() || topic.reasonDe,
      };
    });
  } catch (error) {
    console.error("Error ensuring German hot topics:", error);
    return topics;
  }
}

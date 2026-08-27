import { prisma } from "@/lib/prisma";
import { embedTitle, embedTitles, cosineSimilarity, DEFAULT_TITLE_SIMILARITY_THRESHOLD } from "@/lib/embeddings";

const RECENT_WINDOW_DAYS = 30;
const MAX_CANDIDATES = 200;

export type DuplicateCandidate = {
  id: string;
  kind: "article" | "job";
  title: string;
  slug?: string;
  status?: string;
  originalUrl?: string;
  titleEmbedding: string | null;
};

export type DuplicateMatch = {
  id: string;
  kind: "article" | "job";
  matchType: "url" | "title" | "semantic";
  title: string;
  slug?: string;
  status?: string;
  score: number;
};

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Recent articles (candidates for both exact and semantic matching) plus, if
// requested, research-desk jobs still QUEUED/RUNNING - so a topic someone
// just dispatched shows as a duplicate before its article even exists.
export async function loadDuplicateCandidates(
  options: { includeInProgressResearch?: boolean } = {}
): Promise<DuplicateCandidate[]> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const articles = await prisma.article.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
    select: {
      id: true,
      slug: true,
      status: true,
      originalUrl: true,
      originalTitle: true,
      generatedTitle: true,
      titleEmbedding: true,
    },
  });

  const candidates: DuplicateCandidate[] = articles.map((article) => ({
    id: article.id,
    kind: "article",
    title: article.generatedTitle || article.originalTitle,
    slug: article.slug,
    status: article.status,
    originalUrl: article.originalUrl,
    titleEmbedding: article.titleEmbedding,
  }));

  if (options.includeInProgressResearch) {
    const jobs = await prisma.jobRun.findMany({
      where: { status: { in: ["QUEUED", "RUNNING"] }, topic: { not: null }, mode: { startsWith: "research" } },
      select: { id: true, status: true, topic: true },
    });

    for (const job of jobs) {
      if (!job.topic) continue;
      candidates.push({
        id: job.id,
        kind: "job",
        title: job.topic,
        status: job.status,
        titleEmbedding: null,
      });
    }
  }

  return candidates;
}

// Fills in missing embeddings for candidates, batched into a single LM
// Studio call, and persists newly computed article embeddings so future
// lookups don't need to recompute them.
async function ensureCandidateEmbeddings(candidates: DuplicateCandidate[]): Promise<void> {
  const missing = candidates.filter((c) => !c.titleEmbedding);
  if (missing.length === 0) return;

  const vectors = await embedTitles(missing.map((c) => c.title));

  await Promise.all(
    missing.map(async (candidate, index) => {
      const vector = vectors[index];
      if (!vector) return;
      candidate.titleEmbedding = JSON.stringify(vector);
      if (candidate.kind === "article") {
        await prisma.article
          .update({ where: { id: candidate.id }, data: { titleEmbedding: candidate.titleEmbedding } })
          .catch(() => {});
      }
    })
  );
}

function bestSemanticMatch(
  targetEmbedding: number[],
  candidates: DuplicateCandidate[],
  threshold: number
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;

  for (const candidate of candidates) {
    if (!candidate.titleEmbedding) continue;
    let vector: number[];
    try {
      vector = JSON.parse(candidate.titleEmbedding);
    } catch {
      continue;
    }

    const score = cosineSimilarity(targetEmbedding, vector);
    if (score >= threshold && (!best || score > best.score)) {
      best = {
        id: candidate.id,
        kind: candidate.kind,
        matchType: "semantic",
        title: candidate.title,
        slug: candidate.slug,
        status: candidate.status,
        score,
      };
    }
  }

  return best;
}

function exactMatch(
  input: { title: string; titleDe?: string; url?: string },
  candidates: DuplicateCandidate[]
): DuplicateMatch | null {
  if (input.url) {
    const urlMatch = candidates.find((c) => c.originalUrl === input.url);
    if (urlMatch) {
      return { id: urlMatch.id, kind: urlMatch.kind, matchType: "url", title: urlMatch.title, slug: urlMatch.slug, status: urlMatch.status, score: 1 };
    }
  }

  const titleKeys = [input.title, input.titleDe].filter(Boolean).map((t) => normalizeTitle(t as string));
  for (const candidate of candidates) {
    if (titleKeys.includes(normalizeTitle(candidate.title))) {
      return { id: candidate.id, kind: candidate.kind, matchType: "title", title: candidate.title, slug: candidate.slug, status: candidate.status, score: 1 };
    }
  }

  return null;
}

// Full duplicate check for a single title: exact URL/title match first (free),
// falling back to embedding-based semantic similarity. Returns null if the
// embedding model is unavailable and no exact match was found - callers
// should treat that as "cannot determine", not "definitely unique".
export async function findDuplicate(
  input: { title: string; titleDe?: string; url?: string },
  candidates: DuplicateCandidate[],
  options: { threshold?: number } = {}
): Promise<DuplicateMatch | null> {
  const exact = exactMatch(input, candidates);
  if (exact) return exact;

  await ensureCandidateEmbeddings(candidates);
  const targetEmbedding = await embedTitle(input.titleDe || input.title);
  if (!targetEmbedding) return null;

  return bestSemanticMatch(targetEmbedding, candidates, options.threshold ?? DEFAULT_TITLE_SIMILARITY_THRESHOLD);
}

// Batched variant for annotating many topics at once (e.g. a whole Hot Topics
// snapshot) - embeds all target titles in a single LM Studio call instead of
// one per topic.
export async function findDuplicatesBatch(
  inputs: Array<{ title: string; titleDe?: string; url?: string }>,
  candidates: DuplicateCandidate[],
  options: { threshold?: number } = {}
): Promise<Array<DuplicateMatch | null>> {
  const threshold = options.threshold ?? DEFAULT_TITLE_SIMILARITY_THRESHOLD;
  const exactResults = inputs.map((input) => exactMatch(input, candidates));

  const needsSemantic = inputs
    .map((input, index) => ({ input, index }))
    .filter(({ index }) => !exactResults[index]);

  if (needsSemantic.length === 0) return exactResults;

  await ensureCandidateEmbeddings(candidates);
  const vectors = await embedTitles(needsSemantic.map(({ input }) => input.titleDe || input.title));

  const results = [...exactResults];
  needsSemantic.forEach(({ index }, batchIndex) => {
    const vector = vectors[batchIndex];
    results[index] = vector ? bestSemanticMatch(vector, candidates, threshold) : null;
  });

  return results;
}

// Cheap, no-embedding lookup used on every Hot Topics response (including
// fast polling): catches exact re-dispatch of the same topic immediately,
// without waiting for the next full snapshot / KI-Filter run.
export async function loadCheapDuplicateIndex(): Promise<DuplicateCandidate[]> {
  return loadDuplicateCandidates({ includeInProgressResearch: true });
}

export function lookupExactDuplicate(
  input: { title: string; titleDe?: string; url?: string },
  candidates: DuplicateCandidate[]
): DuplicateMatch | null {
  return exactMatch(input, candidates);
}

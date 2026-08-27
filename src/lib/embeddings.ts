import { embed, embedMany } from "ai";
import { resolveEmbeddingModel } from "@/lib/llm-settings";

const EMBEDDING_TIMEOUT_MS = 15000;
const BACKOFF_MS = 5 * 60 * 1000;

export const DEFAULT_TITLE_SIMILARITY_THRESHOLD = 0.88;

// If LM Studio has no embedding model loaded, every call fails the same way.
// Back off for a while after the first failure instead of retrying (and
// timing out) on every single title during a big pipeline run.
let unavailableUntil = 0;

function normalizeForEmbedding(text: string): string {
  return text.trim().slice(0, 500);
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("EMBEDDING_TIMEOUT")), EMBEDDING_TIMEOUT_MS);
    }),
  ]);
}

export async function embedTitle(title: string): Promise<number[] | null> {
  const value = normalizeForEmbedding(title);
  if (!value || Date.now() < unavailableUntil) return null;

  try {
    const model = await resolveEmbeddingModel();
    const { embedding } = await withTimeout(embed({ model, value }));
    return embedding;
  } catch (error) {
    unavailableUntil = Date.now() + BACKOFF_MS;
    console.warn("[embeddings] embedTitle unavailable, backing off", { message: (error as Error)?.message });
    return null;
  }
}

// Batched variant for embedding many titles in a single LM Studio round-trip.
// Returns one entry per input title (null where embedding failed or the
// title was empty), preserving input order.
export async function embedTitles(titles: string[]): Promise<Array<number[] | null>> {
  const values = titles.map(normalizeForEmbedding);
  if (Date.now() < unavailableUntil) return values.map(() => null);

  const nonEmptyIndexes = values.map((v, i) => (v ? i : -1)).filter((i) => i !== -1);
  if (nonEmptyIndexes.length === 0) return values.map(() => null);

  try {
    const model = await resolveEmbeddingModel();
    const { embeddings } = await withTimeout(
      embedMany({
        model,
        values: nonEmptyIndexes.map((i) => values[i]),
      })
    );

    const result: Array<number[] | null> = values.map(() => null);
    nonEmptyIndexes.forEach((originalIndex, batchIndex) => {
      result[originalIndex] = embeddings[batchIndex] || null;
    });
    return result;
  } catch (error) {
    unavailableUntil = Date.now() + BACKOFF_MS;
    console.warn("[embeddings] embedTitles unavailable, backing off", { message: (error as Error)?.message });
    return values.map(() => null);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

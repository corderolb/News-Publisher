import { createOpenAI } from "@ai-sdk/openai";
import { prisma } from "@/lib/prisma";

export const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
const DEFAULT_PRIMARY_MODEL = process.env.LMSTUDIO_MODEL || "local-model";
const DEFAULT_EMBEDDING_MODEL = process.env.LMSTUDIO_EMBEDDING_MODEL || "text-embedding-nomic-embed-text-v1.5";

// Synthetic provider built from .env, used whenever a role has no explicit
// LlmProvider assigned (fresh install, nobody's touched the settings page
// yet). This is what makes a zero-config Docker install work out of the box.
export const ENV_DEFAULT_PROVIDER_ID = "__env-default__";
const ENV_DEFAULT_PROVIDER: LlmProviderRow = {
  id: ENV_DEFAULT_PROVIDER_ID,
  name: "Server-Standard (.env)",
  baseURL: LMSTUDIO_BASE_URL,
  apiKey: process.env.LMSTUDIO_API_KEY || null,
};

export type LlmProviderRow = { id: string; name: string; baseURL: string; apiKey: string | null };

export type LmStudioModel = {
  id: string;
  type: "llm" | "vlm" | "embeddings" | string;
  state: "loaded" | "not-loaded" | string;
  publisher?: string;
  arch?: string;
};

function buildClient(provider: LlmProviderRow) {
  return createOpenAI({ baseURL: provider.baseURL, apiKey: provider.apiKey || "not-needed" });
}

// LM Studio's extended /api/v0/models endpoint (not the plain OpenAI-compat
// /v1/models) reports type (llm/vlm/embeddings) and load state per model -
// exactly what both the embedding auto-detect and the admin model pickers
// need. Only LM-Studio-shaped local URLs implement it; every other
// OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Together, Ollama)
// falls back to the plain /models endpoint. Cached per base URL so a
// settings-page render and a pipeline run started moments later don't both
// pay the round-trip.
const modelListCache = new Map<string, { models: LmStudioModel[]; expiresAt: number }>();

export async function listModelsForProvider(
  provider: { baseURL: string },
  options?: { fresh?: boolean }
): Promise<LmStudioModel[]> {
  const cacheKey = provider.baseURL;
  const cached = modelListCache.get(cacheKey);
  if (!options?.fresh && cached && Date.now() < cached.expiresAt) {
    return cached.models;
  }

  const lmStudioEndpoint = provider.baseURL.replace(/\/v1\/?$/, "/api/v0/models");
  const plainEndpoint = `${provider.baseURL.replace(/\/$/, "")}/models`;

  for (const endpoint of [lmStudioEndpoint, plainEndpoint]) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;

      const body = await response.json();
      const rawModels: Array<{ id: string; type?: string; state?: string; publisher?: string; arch?: string }> =
        Array.isArray(body?.data) ? body.data : [];
      if (rawModels.length === 0) continue;

      const models: LmStudioModel[] = rawModels.map((m) => ({
        id: m.id,
        type: m.type || "llm",
        state: m.state || "unknown",
        publisher: m.publisher,
        arch: m.arch,
      }));
      modelListCache.set(cacheKey, { models, expiresAt: Date.now() + 30_000 });
      return models;
    } catch {
      // try the next endpoint / fall through to the cached-or-empty return below
    }
  }

  // Neither endpoint worked (provider unreachable, or a cloud API that
  // exposes no discovery endpoint at all) - surface whatever we last knew
  // about rather than throwing, so callers can render a clear "not
  // reachable" state or fall back to manual model-id entry.
  return cached?.models || [];
}

type SettingsRow = {
  primaryProviderId: string | null;
  primaryProvider: LlmProviderRow | null;
  primaryModel: string | null;
  embeddingProviderId: string | null;
  embeddingProvider: LlmProviderRow | null;
  embeddingModel: string | null;
};

let settingsCache: { row: SettingsRow | null; expiresAt: number } | null = null;

async function getSettingsRow(): Promise<SettingsRow | null> {
  if (settingsCache && Date.now() < settingsCache.expiresAt) return settingsCache.row;

  const row = await prisma.modelSettings
    .findFirst({ include: { primaryProvider: true, embeddingProvider: true } })
    .catch(() => null);
  settingsCache = { row, expiresAt: Date.now() + 15_000 };
  return row;
}

function invalidateSettingsCache() {
  settingsCache = null;
}

function resolveProvider(explicit: LlmProviderRow | null): LlmProviderRow {
  return explicit || ENV_DEFAULT_PROVIDER;
}

export async function resolvePrimaryModel() {
  const row = await getSettingsRow();
  const provider = resolveProvider(row?.primaryProvider ?? null);
  const modelId = row?.primaryModel || DEFAULT_PRIMARY_MODEL;
  return buildClient(provider)(modelId);
}

export async function resolveEmbeddingModel() {
  const row = await getSettingsRow();
  const provider = resolveProvider(row?.embeddingProvider ?? null);

  let modelId = row?.embeddingModel;
  if (!modelId) {
    // No explicit pin: prefer whatever the provider currently reports as its
    // loaded embeddings-capable model (only meaningful for LM Studio), so
    // switching the loaded model there takes effect without visiting this
    // settings page.
    const models = await listModelsForProvider(provider);
    const loaded = models.find((m) => m.type === "embeddings" && m.state === "loaded");
    modelId = loaded?.id || DEFAULT_EMBEDDING_MODEL;
  }

  return buildClient(provider).textEmbeddingModel(modelId);
}

export async function listLlmProviders(): Promise<LlmProviderRow[]> {
  return prisma.llmProvider.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createLlmProvider(data: { name: string; baseURL: string; apiKey: string | null }): Promise<void> {
  await prisma.llmProvider.create({ data });
}

export async function updateLlmProvider(
  id: string,
  data: { name: string; baseURL: string; apiKey: string | null }
): Promise<void> {
  await prisma.llmProvider.update({ where: { id }, data });
  invalidateSettingsCache();
}

export async function deleteLlmProvider(id: string): Promise<void> {
  await prisma.llmProvider.delete({ where: { id } });
  invalidateSettingsCache();
}

export type ModelSettingsAdminView = {
  providers: LlmProviderRow[];
  envDefaultProvider: LlmProviderRow;
  primaryProviderId: string;
  primaryModel: string | null;
  embeddingProviderId: string;
  embeddingModel: string | null;
  effectivePrimaryModel: string;
  effectiveEmbeddingModel: string;
  embeddingIsAutoDetected: boolean;
  modelsByProvider: Record<string, LmStudioModel[]>;
  defaultPrimaryModel: string;
  defaultEmbeddingModel: string;
};

export async function getModelSettingsForAdmin(): Promise<ModelSettingsAdminView> {
  const [row, providers] = await Promise.all([
    prisma.modelSettings.findFirst({ include: { primaryProvider: true, embeddingProvider: true } }),
    listLlmProviders(),
  ]);

  const allProviders = [ENV_DEFAULT_PROVIDER, ...providers];
  const modelLists = await Promise.all(allProviders.map((p) => listModelsForProvider(p, { fresh: true })));
  const modelsByProvider: Record<string, LmStudioModel[]> = {};
  allProviders.forEach((p, i) => {
    modelsByProvider[p.id] = modelLists[i];
  });

  const primaryProviderId = row?.primaryProviderId || ENV_DEFAULT_PROVIDER_ID;
  const embeddingProviderId = row?.embeddingProviderId || ENV_DEFAULT_PROVIDER_ID;

  const effectivePrimaryModel = row?.primaryModel || DEFAULT_PRIMARY_MODEL;

  const embeddingProvider = allProviders.find((p) => p.id === embeddingProviderId) || ENV_DEFAULT_PROVIDER;
  const loadedEmbedding = modelsByProvider[embeddingProvider.id]?.find(
    (m) => m.type === "embeddings" && m.state === "loaded"
  );
  const effectiveEmbeddingModel = row?.embeddingModel || loadedEmbedding?.id || DEFAULT_EMBEDDING_MODEL;

  return {
    providers,
    envDefaultProvider: ENV_DEFAULT_PROVIDER,
    primaryProviderId,
    primaryModel: row?.primaryModel ?? null,
    embeddingProviderId,
    embeddingModel: row?.embeddingModel ?? null,
    effectivePrimaryModel,
    effectiveEmbeddingModel,
    embeddingIsAutoDetected: !row?.embeddingModel,
    modelsByProvider,
    defaultPrimaryModel: DEFAULT_PRIMARY_MODEL,
    defaultEmbeddingModel: DEFAULT_EMBEDDING_MODEL,
  };
}

export async function updateModelSettings(data: {
  primaryProviderId?: string | null;
  primaryModel?: string | null;
  embeddingProviderId?: string | null;
  embeddingModel?: string | null;
}): Promise<void> {
  const existing = await prisma.modelSettings.findFirst();

  // The env-default "provider" is not a real LlmProvider row - persisting
  // its sentinel id would violate the FK, so a selection of it is stored as
  // null (== "use the automatic/env fallback", same as before this feature).
  const normalized = {
    ...data,
    primaryProviderId: data.primaryProviderId === ENV_DEFAULT_PROVIDER_ID ? null : data.primaryProviderId,
    embeddingProviderId: data.embeddingProviderId === ENV_DEFAULT_PROVIDER_ID ? null : data.embeddingProviderId,
  };

  if (existing) {
    await prisma.modelSettings.update({ where: { id: existing.id }, data: normalized });
  } else {
    await prisma.modelSettings.create({ data: normalized });
  }

  invalidateSettingsCache();
}

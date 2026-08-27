// Server-side shared state for research topic computations.
// This module is imported by both the compute endpoint (/api/research/topics)
// and the live-status endpoint (/api/research/status), so all connected users
// see the same list of currently running KI-runs no matter which tab or
// which preset/focus combination initiated them.

type SharedGlobal = typeof globalThis & {
  __researchInflight?: Map<string, Promise<unknown>>;
  __researchInflightStartedAt?: Map<string, number>;
  __researchInflightMeta?: Map<string, { preset: string; focusThemes: string[] }>;
};

const g = globalThis as SharedGlobal;

if (!g.__researchInflight) {
  g.__researchInflight = new Map<string, Promise<unknown>>();
}
if (!g.__researchInflightStartedAt) {
  g.__researchInflightStartedAt = new Map<string, number>();
}
if (!g.__researchInflightMeta) {
  g.__researchInflightMeta = new Map<string, { preset: string; focusThemes: string[] }>();
}

export const inflight = g.__researchInflight!;
export const inflightStartedAt = g.__researchInflightStartedAt!;
export const inflightMetaMap = g.__researchInflightMeta!;

export function buildCacheKey(preset: string, focusThemes: string[]): string {
  return `${preset}::${focusThemes.join('|')}`;
}

export type ActiveRun = {
  cacheKey: string;
  preset: string;
  focusThemes: string[];
  startedAt: string;
  runtimeMs: number;
};

export function listActiveRuns(): ActiveRun[] {
  const now = Date.now();
  const runs: ActiveRun[] = [];

  for (const cacheKey of inflight.keys()) {
    const started = inflightStartedAt.get(cacheKey);
    const meta = inflightMetaMap.get(cacheKey);
    runs.push({
      cacheKey,
      preset: meta?.preset || cacheKey.split('::')[0] || 'unknown',
      focusThemes: meta?.focusThemes || (cacheKey.split('::')[1] || '').split('|').filter(Boolean),
      startedAt: started ? new Date(started).toISOString() : new Date(now).toISOString(),
      runtimeMs: started ? Math.max(0, now - started) : 0,
    });
  }

  return runs;
}

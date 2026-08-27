import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  collectHotTopics,
  FilteredHotTopic,
  filterHotTopicsWithAI,
  matchAuthorsForTopics,
  parseFocusThemes,
} from '@/lib/research-topics';
import {
  buildCacheKey,
  inflight,
  inflightMetaMap,
  inflightStartedAt,
} from '@/lib/research-shared-state';
import { getSnapshotDelegate, SnapshotRow } from '@/lib/research-snapshot-delegate';
import {
  loadCheapDuplicateIndex,
  loadDuplicateCandidates,
  lookupExactDuplicate,
  findDuplicatesBatch,
  type DuplicateMatch,
} from '@/lib/dedupe';

type EnrichedTopic = FilteredHotTopic & {
  suggestedAuthor: { id: string; name: string; reason: string } | null;
  duplicate?: DuplicateMatch | null;
};

// Cheap (no-embedding) recheck applied to every response, including fast
// polling: catches a topic someone just dispatched immediately, without
// waiting for the next full KI-Filter snapshot. Any duplicate already baked
// into the snapshot (from the semantic pass below) is kept unless this finds
// a more certain exact match.
async function attachDuplicateFlags(topics: EnrichedTopic[]): Promise<EnrichedTopic[]> {
  if (topics.length === 0) return topics;
  const candidates = await loadCheapDuplicateIndex();

  return topics.map((topic) => {
    const cheapMatch = lookupExactDuplicate(
      { title: topic.title, titleDe: topic.titleDe, url: topic.url },
      candidates
    );
    return { ...topic, duplicate: cheapMatch || topic.duplicate || null };
  });
}

type TopicResponse = {
  ok: true;
  focusThemes: string[];
  preset: string;
  primaryDomain: string;
  topics: EnrichedTopic[];
  generatedAt: string;
  fromDb: boolean;
  inflight: boolean;
  inflightStartedAt: string | null;
  ai: {
    usedAI: boolean;
    aiDurationMs: number | null;
    aiIncluded: number;
    aiRejected: number;
    aiError: string | null;
    fallbackReason: string | null;
    inputTopics: number;
  };
};

function inflightMeta(cacheKey: string) {
  const running = inflight.has(cacheKey);
  const started = inflightStartedAt.get(cacheKey);
  return {
    inflight: running,
    inflightStartedAt: running && started ? new Date(started).toISOString() : null,
  };
}

function buildResponseFromSnapshot(snapshot: SnapshotRow, preset: string): TopicResponse {
  let topics: EnrichedTopic[] = [];
  try {
    const parsed = JSON.parse(snapshot.payload);
    topics = Array.isArray(parsed) ? parsed : [];
  } catch {
    topics = [];
  }

  const effectiveFocusThemes = String(snapshot.focusThemes || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    ok: true,
    focusThemes: effectiveFocusThemes,
    preset,
    primaryDomain: snapshot.primaryDomain,
    topics,
    generatedAt: snapshot.generatedAt.toISOString(),
    fromDb: true,
    inflight: false,
    inflightStartedAt: null,
    ai: {
      usedAI: snapshot.usedAI,
      aiDurationMs: snapshot.aiDurationMs,
      aiIncluded: snapshot.aiIncluded,
      aiRejected: snapshot.aiRejected,
      aiError: snapshot.aiError,
      fallbackReason: snapshot.fallbackReason,
      inputTopics: snapshot.inputTopics,
    },
  };
}

// Loads the single newest snapshot for a preset. Focus themes intentionally
// play no role here: they only steer how a *new* snapshot is computed, never
// which already-computed snapshot is shown.
async function loadLatestSnapshot(preset: string): Promise<TopicResponse | null> {
  try {
    const snapshotDelegate = getSnapshotDelegate();
    if (!snapshotDelegate) return null;

    const snapshot = await snapshotDelegate.findFirst({
      where: { preset },
      orderBy: { generatedAt: 'desc' },
    });

    if (!snapshot) return null;

    return buildResponseFromSnapshot(snapshot, preset);
  } catch (error) {
    console.error('[research-topics] loadLatestSnapshot failed. Wahrscheinlich muss der dev-Server nach dem Prisma-Schema-Update neu gestartet werden.', error);
    return null;
  }
}

async function loadSnapshotById(id: string, preset: string): Promise<TopicResponse | null> {
  try {
    const snapshotDelegate = getSnapshotDelegate();
    if (!snapshotDelegate) return null;

    const snapshot = await snapshotDelegate.findFirst({ where: { id } });
    if (!snapshot) return null;

    return buildResponseFromSnapshot(snapshot, preset);
  } catch (error) {
    console.error('[research-topics] loadSnapshotById failed', error);
    return null;
  }
}

async function saveSnapshot(payload: TopicResponse) {
  try {
    const snapshotDelegate = getSnapshotDelegate();
    if (!snapshotDelegate) return;

    await snapshotDelegate.create({
      data: {
        preset: payload.preset,
        focusThemes: payload.focusThemes.join(','),
        primaryDomain: payload.primaryDomain,
        payload: JSON.stringify(payload.topics),
        generatedAt: new Date(payload.generatedAt),
        usedAI: payload.ai.usedAI,
        aiDurationMs: payload.ai.aiDurationMs ?? null,
        aiIncluded: payload.ai.aiIncluded,
        aiRejected: payload.ai.aiRejected,
        aiError: payload.ai.aiError ?? null,
        fallbackReason: payload.ai.fallbackReason ?? null,
        inputTopics: payload.ai.inputTopics,
      },
    });
  } catch (error) {
    console.error('[research-topics] saveSnapshot failed', error);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const focusThemes = parseFocusThemes(url.searchParams.get('focus'));
  const preset = String(
    url.searchParams.get('preset') || process.env.RESEARCH_SOURCE_PRESET || 'entertainment'
  ).toLowerCase().trim();
  const primaryDomain = String(
    url.searchParams.get('domain') || process.env.RESEARCH_PRIMARY_DOMAIN || 'Film, Serien, Schauspieler, Promi-News'
  ).trim();
  const domainTaxonomy = String(url.searchParams.get('taxonomy') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const cacheKey = buildCacheKey(preset, focusThemes);
  const refresh = url.searchParams.get('refresh') === '1';
  const loadOnly = url.searchParams.get('loadOnly') === '1';
  const snapshotId = url.searchParams.get('snapshotId');

  let ownedInflight = false;

  try {
    // Browsing a specific historical snapshot bypasses cache/inflight/compute
    // entirely — it never triggers a new KI run and never touches the "latest"
    // selection logic below.
    if (snapshotId) {
      const snapshot = await loadSnapshotById(snapshotId, preset);
      if (!snapshot) {
        return NextResponse.json({ ok: false, error: 'Snapshot nicht gefunden' }, { status: 404 });
      }
      return NextResponse.json(snapshot);
    }

    const currentInflight = inflight.get(cacheKey);

    // If a compute is already running (started by anyone), never start a second one.
    if (currentInflight) {
      const dbSnapshot = await loadLatestSnapshot(preset);
      const meta = inflightMeta(cacheKey);

      if (dbSnapshot) {
        return NextResponse.json({ ...dbSnapshot, topics: await attachDuplicateFlags(dbSnapshot.topics), ...meta });
      }

      return NextResponse.json({
        ok: true,
        focusThemes,
        preset,
        primaryDomain,
        topics: [],
        generatedAt: new Date().toISOString(),
        fromDb: false,
        ...meta,
        ai: {
          usedAI: false,
          aiDurationMs: null,
          aiIncluded: 0,
          aiRejected: 0,
          aiError: null,
          fallbackReason: 'already-running',
          inputTopics: 0,
        },
      });
    }

    // No in-memory result cache: the DB snapshot is cheap to read and is the
    // single source of truth, so every non-refresh request always sees
    // whatever is actually newest there instead of a possibly stale copy.
    if (!refresh) {
      const dbSnapshot = await loadLatestSnapshot(preset);
      if (dbSnapshot) {
        return NextResponse.json({
          ...dbSnapshot,
          topics: await attachDuplicateFlags(dbSnapshot.topics),
          ...inflightMeta(cacheKey),
        });
      }
    }

    if (loadOnly) {
      return NextResponse.json({
        ok: true,
        focusThemes,
        preset,
        primaryDomain,
        topics: [],
        generatedAt: new Date().toISOString(),
        fromDb: false,
        ...inflightMeta(cacheKey),
        ai: {
          usedAI: false,
          aiDurationMs: null,
          aiIncluded: 0,
          aiRejected: 0,
          aiError: null,
          fallbackReason: 'no-snapshot-yet',
          inputTopics: 0,
        },
      });
    }

    const requestPromise = (async (): Promise<TopicResponse> => {
      const [rawTopics, authors] = await Promise.all([
        collectHotTopics({ limit: 24, preset }),
        prisma.authorProfile.findMany({
          where: { active: true },
          select: { id: true, name: true, bio: true, tone: true, instructions: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      const filterResult = await filterHotTopicsWithAI(rawTopics, focusThemes, {
        primaryDomain,
        domainTaxonomy,
      });

      const authorAssignments = await matchAuthorsForTopics(
        filterResult.topics.map((topic) => ({ key: topic.key, title: topic.title })),
        authors
      );

      const enriched: EnrichedTopic[] = filterResult.topics.map((topic) => {
        const author = authorAssignments.get(topic.key) || null;
        return {
          ...topic,
          suggestedAuthor: author
            ? {
                id: author.id,
                name: author.name,
                reason: author.reason,
              }
            : null,
        };
      });

      // Semantic pass: catches duplicates that read differently across
      // sources (not just an exact URL/title repeat). Baked into the
      // snapshot so it's free to read on every later poll; attachDuplicateFlags
      // still recomputes the cheap exact-match layer on top on every request.
      const semanticCandidates = await loadDuplicateCandidates();
      const semanticMatches = await findDuplicatesBatch(
        enriched.map((topic) => ({ title: topic.title, titleDe: topic.titleDe, url: topic.url })),
        semanticCandidates
      );
      enriched.forEach((topic, index) => {
        topic.duplicate = semanticMatches[index];
      });

      const payload: TopicResponse = {
        ok: true,
        focusThemes,
        preset,
        primaryDomain,
        topics: enriched,
        generatedAt: new Date().toISOString(),
        fromDb: false,
        inflight: false,
        inflightStartedAt: null,
        ai: {
          usedAI: filterResult.diagnostics.usedAI,
          aiDurationMs: filterResult.diagnostics.aiDurationMs,
          aiIncluded: filterResult.diagnostics.aiIncluded,
          aiRejected: filterResult.diagnostics.aiRejected,
          aiError: filterResult.diagnostics.aiError,
          fallbackReason: filterResult.diagnostics.fallbackReason,
          inputTopics: filterResult.diagnostics.inputTopics,
        },
      };

      await saveSnapshot(payload);
      return payload;
    })();

    inflight.set(cacheKey, requestPromise);
    inflightStartedAt.set(cacheKey, Date.now());
    inflightMetaMap.set(cacheKey, { preset, focusThemes });
    ownedInflight = true;

    const payload = await requestPromise;
    payload.topics = await attachDuplicateFlags(payload.topics);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('[research-topics] GET failed', {
      message: error?.message,
      preset,
      focusThemes,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Research-Themen konnten nicht geladen werden' },
      { status: 500 }
    );
  } finally {
    if (ownedInflight) {
      inflight.delete(cacheKey);
      inflightStartedAt.delete(cacheKey);
      inflightMetaMap.delete(cacheKey);
    }
  }
}

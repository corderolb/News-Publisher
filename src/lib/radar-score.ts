import { generateText } from 'ai';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryModel } from '@/lib/llm-settings';
import { buildRadarScoringPrompt } from '@/lib/radar-prompt';
import { loadDuplicateCandidates, findDuplicatesBatch } from '@/lib/dedupe';
import { matchAuthorsForTopics, buildAuthorRosterText } from '@/lib/research-topics';
import { enqueueRadarWrite, isAnyJobRunning, drainQueue } from '@/lib/job-queue';
import { getErrorMessage } from '@/lib/errors';

const SCORING_TIMEOUT_MS = 150_000;

// A single call scoring 100-200 items at once asks a local model to generate
// a very long JSON response in one shot - that alone risks the timeout
// independent of whether LM Studio is otherwise healthy, and when it DOES
// fail, all 100-200 items fall back to a flat neutral score together instead
// of just a handful. Chunking keeps each individual call fast and limits the
// blast radius of one failed chunk to CHUNK_SIZE items, not the whole batch.
// Sized from a measured baseline, not a guess: a 25-item chunk against the
// reasoning-heavy local model in use took 131s (~5.2s/item) - uncomfortably
// close to even a doubled 120s timeout. 12 items keeps real-world duration
// (~65s) comfortably under SCORING_TIMEOUT_MS with margin for slower titles.
const SCORING_CHUNK_SIZE = 12;

function extractJsonObject(text: string): string | null {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || first >= last) return null;
  return text.slice(first, last + 1);
}

async function scoreChunk(
  items: Array<{ id: string; title: string; category: string }>
): Promise<Map<string, { score: number; reason: string }>> {
  const result = new Map<string, { score: number; reason: string }>();
  if (items.length === 0) return result;

  const chunkStart = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCORING_TIMEOUT_MS);

    const prompt = await buildRadarScoringPrompt(
      items.map((item) => ({ key: item.id, title: item.title, category: item.category }))
    );

    console.log(`[radar-score] chunk of ${items.length} items: calling LLM (model resolution + request)...`);

    const model = await resolvePrimaryModel();
    console.log(`[radar-score] resolved model: ${model.modelId}, sending request now`);

    const { text } = await generateText({
      model,
      abortSignal: controller.signal,
      prompt,
    }).finally(() => clearTimeout(timer));

    console.log(`[radar-score] chunk responded after ${Math.round((Date.now() - chunkStart) / 1000)}s, ${text.length} chars`);

    const jsonText = extractJsonObject(text);
    if (!jsonText) throw new Error('Keine gueltige JSON-Antwort');

    const parsed = JSON.parse(jsonText) as { items?: Array<{ key?: string; score?: number; reason?: string }> };
    for (const entry of parsed.items || []) {
      if (!entry.key) continue;
      const score = Number.isFinite(entry.score) ? Math.max(0, Math.min(100, Number(entry.score))) : 50;
      result.set(entry.key, { score, reason: String(entry.reason || '').trim() || 'Keine Begruendung.' });
    }
    console.log(`[radar-score] chunk parsed ${result.size}/${items.length} items with real scores`);
  } catch (error) {
    console.warn('[radar-score] scoring chunk failed, using flat fallback score', {
      itemCount: items.length,
      elapsedSec: Math.round((Date.now() - chunkStart) / 1000),
      message: (error as Error)?.message,
    });
  }

  for (const item of items) {
    if (!result.has(item.id)) {
      result.set(item.id, { score: 50, reason: 'Fallback: keine KI-Bewertung verfuegbar.' });
    }
  }

  return result;
}

// There's no natural keyword heuristic for "editorial priority" the way
// relevance-filtering or author-matching have one - on timeout, exception,
// malformed JSON, or an item the model simply skipped, everything in that
// chunk falls back to a flat neutral score rather than being silently
// dropped from the queue. Splits the full item list into small sequential
// chunks (see SCORING_CHUNK_SIZE) so one bad/slow chunk doesn't flatline the
// whole batch, and later chunks still get a real chance at proper scores.
async function scoreBatch(
  items: Array<{ id: string; title: string; category: string }>
): Promise<Map<string, { score: number; reason: string }>> {
  const result = new Map<string, { score: number; reason: string }>();
  const totalChunks = Math.ceil(items.length / SCORING_CHUNK_SIZE);
  console.log(`[radar-score] scoring ${items.length} items in ${totalChunks} chunk(s) of up to ${SCORING_CHUNK_SIZE}`);

  for (let i = 0; i < items.length; i += SCORING_CHUNK_SIZE) {
    const chunk = items.slice(i, i + SCORING_CHUNK_SIZE);
    console.log(`[radar-score] starting chunk ${Math.floor(i / SCORING_CHUNK_SIZE) + 1}/${totalChunks}`);
    const chunkResult = await scoreChunk(chunk);
    for (const [key, value] of chunkResult) result.set(key, value);
  }

  return result;
}

// In-process guard against overlapping invocations: scoreAndAssignRadarItems
// is called both from radar-scan.ts (after a scan, or manually) and from
// instrumentation.ts's independent 60s safety-net tick. Without this, two
// overlapping calls could each fire their own scoring/author-match request
// to LM Studio at the same time - LM Studio only accepts one request at a
// time and aborts the rest (this is what "es duerfen nicht mehrere
// parallele Anfragen an das Model gehen" was actually hitting).
let acquiring = false;

// Dedupe -> score -> assign author -> enqueue, for whatever is currently
// waiting in the queue. Called right after a scan finds new items, and as a
// 60s safety net in case a chain was interrupted mid-batch. Wrapped in a
// JobRun (mode: radar-scoring) so it participates in the exact same
// single-flight lock as article writes (isAnyJobRunning/drainQueue) - a
// write in progress blocks scoring from starting, and vice versa, since both
// call LM Studio and only one request may be in flight system-wide.
export async function scoreAndAssignRadarItems(): Promise<void> {
  if (acquiring) return;
  acquiring = true;

  try {
    if (await isAnyJobRunning()) return;

    const job = await prisma.jobRun.create({
      data: { status: 'RUNNING', mode: 'radar-scoring', startedAt: new Date() },
    });

    try {
      await runScoreAndAssign();
      await prisma.jobRun.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), message: 'Bewertung und Zuordnung abgeschlossen.' },
      });
    } catch (error) {
      await prisma.jobRun.update({
        where: { id: job.id },
        data: { status: 'FAILED', finishedAt: new Date(), message: getErrorMessage(error) },
      });
    }
  } finally {
    acquiring = false;
    drainQueue().catch((error) => {
      console.error('[radar-score] drainQueue after scoring failed', error);
    });
  }
}

async function runScoreAndAssign(): Promise<void> {
  const settings = await prisma.radarSettings.findFirst();
  const minScore = settings?.minScore ?? 0;

  const discovered = await prisma.radarQueueItem.findMany({
    where: { status: 'DISCOVERED' },
    include: { source: true },
    orderBy: { discoveredAt: 'asc' },
    take: 200,
  });

  if (discovered.length > 0) {
    console.log(`[radar-score] dedup starting for ${discovered.length} discovered items`);
    const candidates = await loadDuplicateCandidates();
    console.log(`[radar-score] loaded ${candidates.length} dedup candidates, starting embedding-based comparison`);
    const matches = await findDuplicatesBatch(
      discovered.map((item) => ({ title: item.title, url: item.originalUrl })),
      candidates
    );
    console.log(`[radar-score] dedup done, ${matches.filter(Boolean).length} duplicates found`);

    const stillFresh: typeof discovered = [];
    for (let i = 0; i < discovered.length; i++) {
      const match = matches[i];
      if (match) {
        await prisma.radarQueueItem.update({
          where: { id: discovered[i].id },
          data: {
            status: 'SKIPPED',
            skipReason: `Duplikat (${Math.round(match.score * 100)}% aehnlich): "${match.title}"`,
          },
        });
      } else {
        stillFresh.push(discovered[i]);
      }
    }

    if (stillFresh.length > 0) {
      const scores = await scoreBatch(
        stillFresh.map((item) => ({ id: item.id, title: item.title, category: item.source.category }))
      );

      for (const item of stillFresh) {
        const entry = scores.get(item.id) ?? { score: 50, reason: 'Keine Begruendung.' };

        if (entry.score < minScore) {
          await prisma.radarQueueItem.update({
            where: { id: item.id },
            data: {
              status: 'SKIPPED',
              skipReason: `Score ${entry.score} unter Mindest-Score ${minScore}.`,
              score: entry.score,
              scoreReason: entry.reason,
              scoredAt: new Date(),
            },
          });
        } else {
          await prisma.radarQueueItem.update({
            where: { id: item.id },
            data: { status: 'SCORED', score: entry.score, scoreReason: entry.reason, scoredAt: new Date() },
          });
        }
      }
    }
  }

  const toAssign = await prisma.radarQueueItem.findMany({
    where: { status: 'SCORED' },
    orderBy: { score: 'desc' },
    take: 100,
  });

  if (toAssign.length > 0) {
    const authors = await prisma.authorProfile.findMany({
      where: { active: true },
      select: { id: true, name: true, bio: true, tone: true, instructions: true },
      orderBy: { name: 'asc' },
    });

    if (authors.length > 0) {
      // Same reasoning as scoring: a single call covering all of toAssign
      // (up to 100 items) asks a local model to produce a very long response
      // in one shot, and research-topics.ts's own timeout for this call is a
      // generous 30 minutes by default - a chunk here fails (and falls back
      // to the keyword heuristic) much sooner than a single giant call would.
      // Roster text (name/bio/tone/instructions per author) doesn't change
      // across chunks within one scoring run - build it once here instead of
      // letting matchAuthorsForTopics re-derive it on every chunk call.
      const rosterText = buildAuthorRosterText(authors);

      const assignments = new Map<string, { id: string; name: string; reason: string }>();
      for (let i = 0; i < toAssign.length; i += SCORING_CHUNK_SIZE) {
        const chunk = toAssign.slice(i, i + SCORING_CHUNK_SIZE);
        const chunkAssignments = await matchAuthorsForTopics(
          chunk.map((item) => ({ key: item.id, title: item.title })),
          authors,
          rosterText
        );
        for (const [key, value] of chunkAssignments) assignments.set(key, value);
      }

      for (const item of toAssign) {
        const assignment = assignments.get(item.id);
        if (!assignment) continue;
        await prisma.radarQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'ASSIGNED',
            authorId: assignment.id,
            authorReason: assignment.reason,
            assignedAt: new Date(),
          },
        });
      }
    }
  }

  await enqueueReadyItems();
}

// Enqueues as many ASSIGNED items as the daily limit and circuit breaker
// allow, highest score first. Anything left over just stays ASSIGNED and is
// picked up automatically once capacity frees (next day, or a manual
// requeue/success resets the circuit breaker).
async function enqueueReadyItems(): Promise<void> {
  const settings = await prisma.radarSettings.findFirst();
  if (!settings) return;
  if (settings.consecutiveFailures >= 3) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const writtenToday = await prisma.radarQueueItem.count({
    where: { status: 'DONE', writtenAt: { gte: todayStart } },
  });

  if (writtenToday >= settings.dailyArticleLimit) return;

  const capacity = settings.dailyArticleLimit - writtenToday;

  const ready = await prisma.radarQueueItem.findMany({
    where: { status: 'ASSIGNED', jobRunId: null },
    orderBy: { score: 'desc' },
    take: capacity,
  });

  for (const item of ready) {
    await enqueueRadarWrite(item.id, settings.publishDirectly);
  }
}

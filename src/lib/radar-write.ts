import { prisma } from '@/lib/prisma';
import { fetchHTMLContent } from '@/lib/fetcher';
import { generateArticleWithResearch, translateCitationsToGerman } from '@/lib/ai';
import { webResearch } from '@/lib/research';
import { slugify, withRandomSuffix } from '@/lib/slug';

async function jobEvent(jobRunId: string, step: string, message: string) {
  await prisma.jobEvent.create({ data: { jobRunId, step, message } });
  await prisma.jobRun.update({ where: { id: jobRunId }, data: { currentStep: step, message } });
}

async function getOrCreateSettings() {
  const existing = await prisma.radarSettings.findFirst();
  if (existing) return existing;
  return prisma.radarSettings.create({ data: {} });
}

// One JobRun = one Radar item, same granularity as research-jobs.ts's
// dispatchResearchTopic (INIT -> ... -> DONE, totalItems: 1) - correct once
// each write is independently queued/retryable, unlike the old campaign
// pipeline's multi-item-per-run shape.
//
// This is the per-candidate body from tonight's pipeline.ts fix (fetch ->
// research -> translate-citations -> generate -> upsert-with-retry, all in
// one try/catch), extracted to stand alone now that campaigns are gone.
export async function writeRadarQueueItem(radarItemId: string, jobRunId: string): Promise<void> {
  const startedAt = Date.now();

  const item = await prisma.radarQueueItem.findUnique({
    where: { id: radarItemId },
    include: { source: true, author: true },
  });

  if (!item || item.status !== 'ASSIGNED' || !item.author) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: 'FAILED', message: 'Radar-Item nicht bereit oder kein Autor zugewiesen', finishedAt: new Date() },
    });
    return;
  }

  await prisma.radarQueueItem.update({ where: { id: radarItemId }, data: { status: 'WRITING' } });
  await prisma.jobRun.update({ where: { id: jobRunId }, data: { totalItems: 1 } });
  await jobEvent(jobRunId, 'INIT', `Radar-Artikel gestartet: "${item.title}"`);

  const settings = await getOrCreateSettings();

  try {
    const fullHtmlContent = item.source.extractFullArticle ? await fetchHTMLContent(item.originalUrl) : item.title;

    if (!fullHtmlContent || fullHtmlContent.length < 200) {
      throw new Error('Zu wenig Inhalt geladen');
    }

    await jobEvent(jobRunId, 'RESEARCH', 'Web-Recherche laeuft.');
    const research = await webResearch(`${item.title} ${item.source.category} latest analysis`, 5);
    const translatedResearch = await translateCitationsToGerman(research);

    await jobEvent(jobRunId, 'WRITE', 'Artikel wird erstellt.');
    const generated = await generateArticleWithResearch({
      title: item.title,
      textContent: fullHtmlContent,
      author: {
        name: item.author.name,
        bio: item.author.bio,
        tone: item.author.tone,
        instructions: item.author.instructions,
      },
      research,
    });

    const baseSlug = slugify(generated.title || item.title || 'news-story');
    const safeSlug = baseSlug || withRandomSuffix('news-story');
    // Exclude this item's own originalUrl from the collision check - a retry
    // upserts the same row, so its own previous slug must not look "taken".
    const slugTaken = await prisma.article.findFirst({
      where: { slug: safeSlug, originalUrl: { not: item.originalUrl } },
    });
    const slug = slugTaken ? withRandomSuffix(safeSlug) : safeSlug;

    const publish = settings.publishDirectly;

    const articleData = {
      sourceId: item.sourceId,
      authorId: item.authorId,
      slug,
      originalTitle: item.title,
      originalContent: fullHtmlContent,
      status: (publish ? 'PUBLISHED' : 'REVIEW') as 'PUBLISHED' | 'REVIEW',
      generatedTitle: generated.title,
      generatedExcerpt: generated.excerpt,
      generatedContent: generated.body,
      seoTitle: generated.seoTitle,
      keywords: generated.keywords.join(', '),
      qualityScore: generated.qualityScore,
      scoreBreakdown: JSON.stringify(generated.scoreBreakdown),
      researchNotes: generated.factChecklist.join('\n- '),
      citations: JSON.stringify(translatedResearch),
      publishedAt: publish ? new Date() : null,
    };

    const article = await prisma.article.upsert({
      where: { originalUrl: item.originalUrl },
      create: { originalUrl: item.originalUrl, ...articleData },
      update: articleData,
    });

    await prisma.radarQueueItem.update({
      where: { id: radarItemId },
      data: { status: 'DONE', articleId: article.id, writtenAt: new Date(), failReason: null },
    });
    await prisma.radarSettings.update({ where: { id: settings.id }, data: { consecutiveFailures: 0 } });

    const durationMs = Date.now() - startedAt;
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: 'COMPLETED',
        processed: 1,
        finishedAt: new Date(),
        durationMs,
        message: `Artikel erstellt: ${generated.title}`,
        currentStep: 'DONE',
      },
    });
    await jobEvent(jobRunId, 'DONE', `Fertig in ${Math.round(durationMs / 1000)}s.`);
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    const failReason = error?.message || 'Unbekannter Fehler';

    await prisma.radarQueueItem.update({ where: { id: radarItemId }, data: { status: 'FAILED', failReason } });

    // Persisted, not in-memory: unlike the old campaign pipeline's loop
    // counter, Radar processes one item per invocation, so the breaker has
    // to survive across separate JobRun calls. radar-score.ts's
    // enqueueReadyItems refuses new writes once this hits 3.
    await prisma.radarSettings.update({
      where: { id: settings.id },
      data: { consecutiveFailures: { increment: 1 } },
    });

    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: 'FAILED', failed: 1, finishedAt: new Date(), durationMs, message: failReason, currentStep: 'FAILED' },
    });
    await jobEvent(jobRunId, 'GENERATION_FAILED', `Fehlgeschlagen: ${failReason}`);
  }
}

import { prisma } from '@/lib/prisma';
import { fetchHTMLContent } from '@/lib/fetcher';
import { generateArticleWithResearch, translateCitationsToGerman } from '@/lib/ai';
import { webResearch } from '@/lib/research';
import { slugify, withRandomSuffix } from '@/lib/slug';
import { matchAuthorsForTopics } from '@/lib/research-topics';
import { loadDuplicateCandidates, findDuplicate, type DuplicateMatch } from '@/lib/dedupe';
import { isAnyJobRunning } from '@/lib/job-queue';
import { getErrorMessage } from '@/lib/errors';

type DispatchInput = {
  topic: string;
  topicUrl?: string;
  authorId?: string;
  publish?: boolean;
  force?: boolean;
};

export class DuplicateTopicError extends Error {
  duplicate: DuplicateMatch;

  constructor(duplicate: DuplicateMatch) {
    const what = duplicate.kind === 'job' ? 'ein laufender Auftrag' : 'ein Artikel';
    super(`Fuer dieses Thema existiert bereits ${what}: "${duplicate.title}"`);
    this.name = 'DuplicateTopicError';
    this.duplicate = duplicate;
  }
}

// Aggregator/homepage URLs must not be used as originalUrl or content basis,
// otherwise the LLM ends up writing about the aggregator itself instead of the
// trending subject.
const AGGREGATOR_HOSTS = [
  'trends.google.com',
  'www.google.com',
  'news.google.com',
  'www.reddit.com',
  'reddit.com',
  'old.reddit.com',
  'www.tvmaze.com',
  'api.tvmaze.com',
  'news.ycombinator.com',
];

function isAggregatorUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return true;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (AGGREGATOR_HOSTS.includes(host)) return true;
    if (host.endsWith('.reddit.com')) return true;
    if (host === 'google.com' || host.endsWith('.google.com')) return true;
    return false;
  } catch {
    return true;
  }
}

async function addEvent(jobRunId: string, step: string, message: string) {
  await prisma.jobEvent.create({
    data: {
      jobRunId,
      step,
      message,
    },
  });

  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      currentStep: step,
      message,
    },
  });
}

export async function dispatchResearchTopic(input: DispatchInput) {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('Kein Thema angegeben');
  }

  // This function does its work synchronously in the same call rather than
  // going through the QUEUED/drainQueue mechanism - fine while it was the
  // only producer of JobRuns, but a real race once the Radar's automated
  // writes also run through the same single-flight queue. Reject immediately
  // (the Research Panel can already surface this) instead of racing.
  if (await isAnyJobRunning()) {
    throw new Error('Pipeline gerade beschäftigt - bitte in Kürze erneut versuchen.');
  }

  const publish = Boolean(input.publish);

  if (!input.force) {
    const candidates = await loadDuplicateCandidates({ includeInProgressResearch: true });
    const duplicate = await findDuplicate({ title: topic, url: input.topicUrl }, candidates);
    // Semantic (fuzzy, cross-source) matches are surfaced to the user via the
    // Hot Topics list but never block dispatch on their own - only an exact
    // URL/title repeat or an already-running job for the same topic does,
    // since those are unambiguous duplicates rather than probabilistic ones.
    if (duplicate && duplicate.matchType !== 'semantic') {
      throw new DuplicateTopicError(duplicate);
    }
  }

  const jobRun = await prisma.jobRun.create({
    data: {
      status: 'QUEUED',
      mode: publish ? 'research-publish' : 'research-review',
      message: `Research-Auftrag wurde angelegt: ${topic}`,
      topic,
      totalItems: 1,
    },
  });

  const startedAt = Date.now();

  try {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    await addEvent(jobRun.id, 'INIT', `Research startet fuer Thema: ${topic}`);

    const activeAuthors = await prisma.authorProfile.findMany({
      where: { active: true },
      select: { id: true, name: true, bio: true, tone: true, instructions: true },
      orderBy: { createdAt: 'asc' },
    });

    const pickedAuthor = input.authorId
      ? activeAuthors.find((author) => author.id === input.authorId) || null
      : (await matchAuthorsForTopics([{ key: 'dispatch', title: topic }], activeAuthors)).get('dispatch') || null;

    const selectedAuthor = pickedAuthor
      ? activeAuthors.find((author) => author.id === pickedAuthor.id) || null
      : activeAuthors[0] || null;

    if (!selectedAuthor) {
      throw new Error('Kein aktiver Autor verfuegbar');
    }

    await addEvent(jobRun.id, 'AUTHOR_SELECT', `Autor ausgewaehlt: ${selectedAuthor.name}`);

    const query = `${topic} latest analysis trend`; 
    const research = await webResearch(query, 8);

    await addEvent(jobRun.id, 'RESEARCH', `${research.length} externe Quellen gesammelt.`);

    // Filter out aggregator URLs so we never fetch or link the trend/reddit
    // homepage as if it were an article about the subject.
    const usableResearch = research.filter((item) => !isAggregatorUrl(item.url));
    const rejectedCount = research.length - usableResearch.length;
    if (rejectedCount > 0) {
      await addEvent(
        jobRun.id,
        'RESEARCH_FILTER',
        `${rejectedCount} Aggregator-Quellen (Google Trends, Reddit, TVMaze) entfernt.`
      );
    }

    const cleanTopicUrl = input.topicUrl && !isAggregatorUrl(input.topicUrl) ? input.topicUrl : null;

    const topLinks = usableResearch.slice(0, 3);
    const htmlChunks = await Promise.all(
      topLinks.map(async (item) => {
        const content = await fetchHTMLContent(item.url);
        if (!content) return '';
        return `Quelle: ${item.title}\n${content.slice(0, 1800)}`;
      })
    );

    const baseText = [
      `Trend-Thema: ${topic}`,
      `URL-Hinweis: ${cleanTopicUrl || '-'}`,
      ...htmlChunks.filter(Boolean),
    ].join('\n\n');

    await addEvent(jobRun.id, 'WRITE', 'Artikel wird erstellt.');

    const translatedResearch = await translateCitationsToGerman(usableResearch);

    // Throws on failure (timeout, network error, malformed response) -
    // caught by this function's own outer try/catch below, which fails the
    // job with the real error message instead of a generic one.
    const generated = await generateArticleWithResearch({
      title: topic,
      textContent: baseText,
      author: {
        name: selectedAuthor.name,
        bio: selectedAuthor.bio,
        tone: selectedAuthor.tone,
        instructions: selectedAuthor.instructions,
      },
      research: translatedResearch,
    });

    const trendSource = await prisma.source.upsert({
      where: { id: 'trend-research-source' },
      update: {
        active: true,
      },
      create: {
        id: 'trend-research-source',
        name: 'Trend Research Desk',
        url: 'https://trends.google.com',
        type: 'HTML',
        category: 'trends',
        active: true,
        maxItemsPerRun: 10,
        extractFullArticle: false,
      },
    });

    const baseSlug = slugify(generated.title || topic || 'trend-topic');
    const safeSlug = baseSlug || withRandomSuffix('trend-topic');
    const existing = await prisma.article.findUnique({ where: { slug: safeSlug } });
    const slug = existing ? withRandomSuffix(safeSlug) : safeSlug;

    const article = await prisma.article.create({
      data: {
        sourceId: trendSource.id,
        authorId: selectedAuthor.id,
        originalUrl: cleanTopicUrl || `https://trend-topic.local/${encodeURIComponent(topic)}`,
        slug,
        originalTitle: topic,
        originalContent: baseText,
        status: publish ? 'PUBLISHED' : 'REVIEW',
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
      },
    });

    const durationMs = Date.now() - startedAt;

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'COMPLETED',
        processed: 1,
        finishedAt: new Date(),
        durationMs,
        message: `Research-Artikel erstellt: ${generated.title}`,
        currentStep: 'DONE',
      },
    });

    await addEvent(jobRun.id, 'DONE', `Fertig in ${Math.round(durationMs / 1000)}s.`);

    return {
      jobRunId: jobRun.id,
      articleId: article.id,
      slug: article.slug,
      author: selectedAuthor.name,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'FAILED',
        failed: 1,
        finishedAt: new Date(),
        durationMs,
        message: getErrorMessage(error, 'Research-Auftrag fehlgeschlagen'),
        currentStep: 'FAILED',
      },
    });

    await prisma.jobEvent.create({
      data: {
        jobRunId: jobRun.id,
        step: 'FAILED',
        message: getErrorMessage(error, 'Research-Auftrag fehlgeschlagen'),
      },
    });

    throw error;
  }
}

import { prisma } from '@/lib/prisma';
import { fetchRSS, extractLinksFromHTML } from '@/lib/fetcher';
import { scoreAndAssignRadarItems } from '@/lib/radar-score';

async function getOrCreateSettings() {
  const existing = await prisma.radarSettings.findFirst();
  if (existing) return existing;
  return prisma.radarSettings.create({ data: {} });
}

// Scans every active Source for new candidates and enqueues them as
// DISCOVERED RadarQueueItem rows - cheap dedupe only (exact URL match). No
// full-text fetch, no semantic dedupe, no scoring here: those are deferred
// to radar-score.ts so a scan that finds nothing new stays fast, and so a
// low-priority candidate never pays for a full-text fetch it doesn't need.
async function discoverCandidates(): Promise<number> {
  const sources = await prisma.source.findMany({ where: { active: true } });
  let discovered = 0;

  for (const source of sources) {
    let items: { title: string; link: string }[] = [];

    try {
      if (source.type === 'RSS') {
        const feedItems = await fetchRSS(source.url);
        items = feedItems.map((item) => ({ title: item.title, link: item.link }));
      } else {
        items = await extractLinksFromHTML(source.url);
      }
    } catch (error) {
      console.error(`[radar-scan] discovery failed for source ${source.name}`, error);
      continue;
    }

    const limited = items.slice(0, Math.max(1, source.maxItemsPerRun));

    for (const item of limited) {
      if (!item.title || !item.link) continue;

      // A FAILED article doesn't block re-discovery - same retry-eligibility
      // rule as the source pipeline used before Radar replaced it.
      const existingArticle = await prisma.article.findUnique({ where: { originalUrl: item.link } });
      if (existingArticle && existingArticle.status !== 'FAILED') continue;

      const existingItem = await prisma.radarQueueItem.findUnique({ where: { originalUrl: item.link } });
      if (existingItem) continue;

      await prisma.radarQueueItem.create({
        data: { sourceId: source.id, originalUrl: item.link, title: item.title },
      });
      discovered++;
    }
  }

  return discovered;
}

async function runScanCycle(settingsId: string): Promise<void> {
  await prisma.radarSettings.update({ where: { id: settingsId }, data: { lastScanAt: new Date() } });

  const discovered = await discoverCandidates();
  if (discovered > 0) {
    console.log(`[radar-scan] discovered ${discovered} new candidate(s)`);
  }

  await scoreAndAssignRadarItems();
}

// Called every 60s tick from instrumentation.ts. lastScanAt is its own
// persisted field (not inferred from the newest RadarQueueItem row) because
// most scans insert zero new rows - an item-anchored due-check would never
// advance and would fire every tick instead of every scanIntervalMinutes.
export async function runRadarScanIfDue(): Promise<void> {
  const settings = await getOrCreateSettings();
  if (!settings.active) return;

  if (settings.lastScanAt) {
    const ageMinutes = (Date.now() - settings.lastScanAt.getTime()) / (1000 * 60);
    if (ageMinutes < settings.scanIntervalMinutes) return;
  }

  await runScanCycle(settings.id);
}

// Manual "Jetzt ausfuehren" trigger (Jobs page / /api/jobs/start) - bypasses
// the interval due-check entirely, same underlying scan cycle.
export async function runRadarScanNow(): Promise<void> {
  const settings = await getOrCreateSettings();
  await runScanCycle(settings.id);
}

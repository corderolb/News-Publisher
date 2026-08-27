import { prisma } from '@/lib/prisma';
import { writeRadarQueueItem } from '@/lib/radar-write';

// The whole pipeline is single-concurrency by design: only one JobRun may be
// RUNNING at a time, system-wide. Everything else - Radar-enqueued writes,
// manual re-queues, and ad-hoc research-panel dispatches (see research-jobs.ts)
// - creates a QUEUED JobRun and waits its turn instead of starting immediately.
export async function isAnyJobRunning(): Promise<boolean> {
  const running = await prisma.jobRun.findFirst({ where: { status: 'RUNNING' } });
  return Boolean(running);
}

// Transitions a QUEUED JobRun to RUNNING and kicks off the actual write. The
// status flip is awaited *before* returning so a caller processing several
// candidates in a loop never races isAnyJobRunning() against this job's own
// start.
async function startRadarWriteJob(jobId: string, radarItemId: string) {
  await prisma.jobRun.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  setTimeout(() => {
    writeRadarQueueItem(radarItemId, jobId)
      .catch(async (error) => {
        await prisma.jobRun.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            message: error?.message || 'Unbekannter Fehler beim Radar-Artikel',
            finishedAt: new Date(),
          },
        });
      })
      .finally(() => {
        drainQueue().catch((error) => {
          console.error('[queue] drainQueue after job finish failed', error);
        });
      });
  }, 10);
}

// Creates a QUEUED JobRun for one Radar item and starts it immediately if the
// queue is idle, otherwise it waits for drainQueue to pick it up.
export async function enqueueRadarWrite(radarItemId: string, publish: boolean, priority = 0) {
  const job = await prisma.jobRun.create({
    data: {
      status: 'QUEUED',
      mode: publish ? 'radar-publish' : 'radar-review',
      priority,
      radarItems: { connect: { id: radarItemId } },
    },
  });

  if (!(await isAnyJobRunning())) {
    await startRadarWriteJob(job.id, radarItemId);
  }

  return job;
}

// Called whenever a job finishes (from startRadarWriteJob's .finally) and as
// a periodic safety net (instrumentation.ts) in case a chain link is ever
// missed, e.g. a server restart while jobs were queued. Highest-priority
// QUEUED job goes first - manual re-queues always outrank the priority-0 jobs
// created during normal scan/score/assign enqueueing.
export async function drainQueue(): Promise<void> {
  if (await isAnyJobRunning()) return;

  const next = await prisma.jobRun.findFirst({
    where: { status: 'QUEUED' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: { radarItems: true },
  });

  if (!next) return;

  const radarItem = next.radarItems[0];
  if (!radarItem) {
    // A QUEUED job with no linked Radar item should never happen by
    // construction (enqueueRadarWrite always connects one), but don't get
    // permanently stuck behind it if it somehow does - fail it and move on.
    await prisma.jobRun.update({
      where: { id: next.id },
      data: { status: 'FAILED', message: 'Kein Radar-Eintrag verknuepft', finishedAt: new Date() },
    });
    await drainQueue();
    return;
  }

  await startRadarWriteJob(next.id, radarItem.id);
}

// Re-queues a FAILED or COMPLETED run's Radar item as a brand-new JobRun at
// the very front of the queue (Date.now() as priority - always higher than
// any previous push) - it still waits for a currently RUNNING job to finish
// first, since only one job may ever be active at a time.
export async function requeueJobRun(jobRunId: string) {
  const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId }, include: { radarItems: true } });

  if (!jobRun) {
    throw new Error('Job-Run nicht gefunden');
  }

  const radarItem = jobRun.radarItems[0];
  if (!radarItem) {
    throw new Error('Ad-hoc Jobs ohne Radar-Eintrag koennen nicht erneut eingereiht werden');
  }
  if (jobRun.status !== 'FAILED' && jobRun.status !== 'COMPLETED') {
    throw new Error('Nur abgeschlossene oder fehlgeschlagene Jobs koennen erneut eingereiht werden');
  }

  await prisma.radarQueueItem.update({
    where: { id: radarItem.id },
    data: { status: 'ASSIGNED', failReason: null },
  });

  const settings = await prisma.radarSettings.findFirst();
  return enqueueRadarWrite(radarItem.id, settings?.publishDirectly ?? false, Date.now());
}

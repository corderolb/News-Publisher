type SchedulerGlobal = typeof globalThis & { __radarSchedulerStarted?: boolean };

const POLL_INTERVAL_MS = 60_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const g = globalThis as SchedulerGlobal;
  if (g.__radarSchedulerStarted) return;
  g.__radarSchedulerStarted = true;

  const { runRadarScanIfDue } = await import('@/lib/radar-scan');
  const { scoreAndAssignRadarItems } = await import('@/lib/radar-score');
  const { drainQueue } = await import('@/lib/job-queue');
  const { runNewsletterIfDue } = await import('@/lib/newsletter');
  const { runFilmRadarIfDue } = await import('@/lib/filmradar');

  setInterval(() => {
    runRadarScanIfDue().catch((error) => {
      console.error('[scheduler] runRadarScanIfDue failed', error);
    });
    // Safety net: covers items left DISCOVERED/SCORED/ASSIGNED if a chain was
    // interrupted mid-batch (e.g. a server restart), independent of the
    // 15-minute scan-due check above.
    scoreAndAssignRadarItems().catch((error) => {
      console.error('[scheduler] scoreAndAssignRadarItems safety-net failed', error);
    });
    // Safety net: the queue normally advances itself the moment a job
    // finishes (see job-queue.ts startRadarWriteJob), this just covers the
    // edge case where that chain was interrupted (e.g. a server restart
    // while jobs were queued).
    drainQueue().catch((error) => {
      console.error('[scheduler] drainQueue failed', error);
    });
    runNewsletterIfDue(process.env.SITE_URL).catch((error) => {
      console.error('[scheduler] runNewsletterIfDue failed', error);
    });
    runFilmRadarIfDue().catch((error) => {
      console.error('[scheduler] runFilmRadarIfDue failed', error);
    });
  }, POLL_INTERVAL_MS);

  console.log(`[scheduler] News Radar auto-scheduler started (${POLL_INTERVAL_MS / 1000}s interval).`);
}

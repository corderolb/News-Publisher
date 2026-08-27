import { NextResponse } from 'next/server';
import { runRadarScanIfDue, runRadarScanNow } from '@/lib/radar-scan';
import { drainQueue } from '@/lib/job-queue';
import { getErrorMessage } from '@/lib/errors';

export const maxDuration = 300; // max length for vercel function timeout

export async function GET(request: Request) {
  // Optionale Authentifizierung für den Cronjob (z.B. Bearer Token vergleichen)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';

    if (force) {
      await runRadarScanNow();
    } else {
      await runRadarScanIfDue();
    }

    // Safety net: advance the write queue too, in case a chain was
    // interrupted (e.g. a server restart while jobs were queued).
    await drainQueue();

    return NextResponse.json({ ok: true, mode: force ? 'radar-forced' : 'radar-if-due' });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

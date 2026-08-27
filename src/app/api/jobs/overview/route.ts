import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [settings, backlogCounts, jobRuns] = await Promise.all([
      prisma.radarSettings.findFirst(),
      prisma.radarQueueItem.groupBy({
        by: ['status'],
        where: { status: { in: ['DISCOVERED', 'SCORED', 'ASSIGNED', 'WRITING'] } },
        _count: true,
      }),
      prisma.jobRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: 120,
        select: {
          id: true,
          status: true,
          mode: true,
          topic: true,
          currentStep: true,
          totalItems: true,
          processed: true,
          failed: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          radarItems: { select: { id: true, title: true }, take: 1 },
        },
      }),
    ]);

    const backlog = { discovered: 0, scored: 0, assigned: 0, writing: 0 };
    for (const row of backlogCounts) {
      if (row.status === 'DISCOVERED') backlog.discovered = row._count;
      if (row.status === 'SCORED') backlog.scored = row._count;
      if (row.status === 'ASSIGNED') backlog.assigned = row._count;
      if (row.status === 'WRITING') backlog.writing = row._count;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const writtenToday = await prisma.radarQueueItem.count({
      where: { status: 'DONE', writtenAt: { gte: todayStart } },
    });

    const nextScanAt =
      settings?.lastScanAt && settings.scanIntervalMinutes
        ? new Date(settings.lastScanAt.getTime() + settings.scanIntervalMinutes * 60_000).toISOString()
        : null;

    const radar = {
      active: settings?.active ?? true,
      lastScanAt: settings?.lastScanAt?.toISOString() ?? null,
      nextScanAt,
      dailyArticleLimit: settings?.dailyArticleLimit ?? 20,
      writtenToday,
      backlog,
    };

    return NextResponse.json({
      ok: true,
      radar,
      jobRuns: jobRuns.map((run) => ({ ...run, radarItem: run.radarItems[0] || null, radarItems: undefined })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Job-Overview konnte nicht geladen werden' },
      { status: 500 }
    );
  }
}

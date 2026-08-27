import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getErrorMessage } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobRunId = url.searchParams.get('jobRunId');

    const include = {
      radarItems: { select: { id: true, title: true }, take: 1 as const },
      events: { orderBy: { createdAt: 'asc' as const }, take: 100 },
    };

    const job = jobRunId
      ? await prisma.jobRun.findUnique({ where: { id: jobRunId }, include })
      : await prisma.jobRun.findFirst({ orderBy: { createdAt: 'desc' }, include });

    if (!job) {
      return NextResponse.json({ ok: true, job: null });
    }

    const { radarItems, ...rest } = job;
    return NextResponse.json({ ok: true, job: { ...rest, radarItem: radarItems[0] || null } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, 'Status konnte nicht geladen werden') }, { status: 500 });
  }
}

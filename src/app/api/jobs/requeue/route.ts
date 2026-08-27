import { NextResponse } from 'next/server';
import { requeueJobRun } from '@/lib/job-queue';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobRunId = typeof body?.jobRunId === 'string' ? body.jobRunId.trim() : '';

    if (!jobRunId) {
      return NextResponse.json({ ok: false, error: 'jobRunId fehlt' }, { status: 400 });
    }

    const newJob = await requeueJobRun(jobRunId);
    return NextResponse.json({ ok: true, jobRunId: newJob.id, status: newJob.status });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Erneutes Einreihen fehlgeschlagen' }, { status: 500 });
  }
}

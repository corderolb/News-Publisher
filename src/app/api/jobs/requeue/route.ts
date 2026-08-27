import { NextResponse } from 'next/server';
import { requeueJobRun } from '@/lib/job-queue';
import { getErrorMessage } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobRunId = typeof body?.jobRunId === 'string' ? body.jobRunId.trim() : '';

    if (!jobRunId) {
      return NextResponse.json({ ok: false, error: 'jobRunId fehlt' }, { status: 400 });
    }

    const newJob = await requeueJobRun(jobRunId);
    return NextResponse.json({ ok: true, jobRunId: newJob.id, status: newJob.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, 'Erneutes Einreihen fehlgeschlagen') }, { status: 500 });
  }
}

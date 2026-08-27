import { NextResponse } from 'next/server';
import { listActiveRuns } from '@/lib/research-shared-state';

export async function GET() {
  const runs = listActiveRuns();

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      anyRunning: runs.length > 0,
      count: runs.length,
      runs,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

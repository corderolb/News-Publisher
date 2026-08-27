import { NextResponse } from 'next/server';
import { runRadarScanNow } from '@/lib/radar-scan';
import { getErrorMessage } from '@/lib/errors';

// Manual "Jetzt ausfuehren" trigger: runs a full scan + score + assign +
// enqueue cycle immediately, bypassing the 15-minute interval due-check.
export async function POST() {
  try {
    await runRadarScanNow();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, 'Radar-Lauf fehlgeschlagen') }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { runRadarScanNow } from '@/lib/radar-scan';

// Manual "Jetzt ausfuehren" trigger: runs a full scan + score + assign +
// enqueue cycle immediately, bypassing the 15-minute interval due-check.
export async function POST() {
  try {
    await runRadarScanNow();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Radar-Lauf fehlgeschlagen' }, { status: 500 });
  }
}

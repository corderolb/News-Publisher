import { NextResponse } from 'next/server';
import { getSnapshotDelegate } from '@/lib/research-snapshot-delegate';

export type SnapshotMeta = {
  id: string;
  generatedAt: string;
  focusThemes: string[];
  primaryDomain: string;
  usedAI: boolean;
  aiIncluded: number;
  aiRejected: number;
  inputTopics: number;
  fallbackReason: string | null;
  topicCount: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preset = String(
    url.searchParams.get('preset') || process.env.RESEARCH_SOURCE_PRESET || 'entertainment'
  ).toLowerCase().trim();
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 20));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  const snapshotDelegate = getSnapshotDelegate();
  if (!snapshotDelegate) {
    return NextResponse.json({ ok: true, snapshots: [], total: 0, offset, limit });
  }

  try {
    const [rows, total] = await Promise.all([
      snapshotDelegate.findMany({
        where: { preset },
        orderBy: { generatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      snapshotDelegate.count({ where: { preset } }),
    ]);

    const snapshots: SnapshotMeta[] = rows.map((row) => {
      let topicCount = 0;
      try {
        const parsed = JSON.parse(row.payload);
        topicCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        topicCount = 0;
      }

      return {
        id: row.id,
        generatedAt: row.generatedAt.toISOString(),
        focusThemes: String(row.focusThemes || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        primaryDomain: row.primaryDomain,
        usedAI: row.usedAI,
        aiIncluded: row.aiIncluded,
        aiRejected: row.aiRejected,
        inputTopics: row.inputTopics,
        fallbackReason: row.fallbackReason,
        topicCount,
      };
    });

    return NextResponse.json({ ok: true, snapshots, total, offset, limit });
  } catch (error: any) {
    console.error('[research-snapshots] GET failed', { message: error?.message, preset });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Snapshot-Historie konnte nicht geladen werden' },
      { status: 500 }
    );
  }
}

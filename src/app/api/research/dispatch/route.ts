import { NextResponse } from 'next/server';
import { dispatchResearchTopic, DuplicateTopicError } from '@/lib/research-jobs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = String(body?.topic || '').trim();
    const topicUrl = body?.topicUrl ? String(body.topicUrl) : undefined;
    const authorId = body?.authorId ? String(body.authorId) : undefined;
    const publish = Boolean(body?.publish);
    const force = Boolean(body?.force);

    if (!topic) {
      return NextResponse.json({ ok: false, error: 'Thema fehlt' }, { status: 400 });
    }

    const result = await dispatchResearchTopic({
      topic,
      topicUrl,
      authorId,
      publish,
      force,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    if (error instanceof DuplicateTopicError) {
      return NextResponse.json(
        { ok: false, error: error.message, duplicate: error.duplicate },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error?.message || 'Research-Auftrag fehlgeschlagen' },
      { status: 500 }
    );
  }
}

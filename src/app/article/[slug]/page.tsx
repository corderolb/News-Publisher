import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
    include: { source: true, author: true },
  });

  if (!article) {
    notFound();
  }

  const citations = article.citations ? safeParseCitations(article.citations) : [];
  const checklist = article.researchNotes
    ? article.researchNotes.split('\n').map((x) => x.trim()).filter(Boolean)
    : [];
  const score = safeParseScoreBreakdown(article.scoreBreakdown);

  return (
    <main className="min-h-screen text-[var(--foreground)]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]">
            Zurueck zur Startseite
          </Link>
        </div>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_10px_30px_rgba(15,76,129,0.08)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{article.source.name}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight text-[var(--primary-strong)]">
            {article.generatedTitle || article.originalTitle}
          </h1>
          <p className="mt-4 text-base leading-8 text-[var(--foreground)]/90">
            {article.generatedExcerpt}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            <span>Autor: {article.author?.name || 'System-Redaktion'}</span>
            <span>Qualitaet: {article.qualityScore ?? '-'} / 100</span>
            <span>Status: {article.status}</span>
          </div>

          {score && (
            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <h2 className="text-base font-extrabold text-[var(--primary-strong)]">Score-Erklaerung</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ScoreRow label="Faktenlage" value={score.factuality} />
                <ScoreRow label="Klarheit" value={score.clarity} />
                <ScoreRow label="Struktur" value={score.structure} />
                <ScoreRow label="SEO" value={score.seo} />
              </div>
              <p className="mt-3 text-sm text-[var(--foreground)]/85">{score.explanation}</p>
            </div>
          )}

          <div className="mt-8 whitespace-pre-wrap text-[16px] leading-8 text-[var(--foreground)]/95">
            {article.generatedContent}
          </div>

          {(article.keywords || '').trim().length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-extrabold text-[var(--primary-strong)]">Themen</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(article.keywords || '').split(',').map((keyword) => keyword.trim()).filter(Boolean).map((keyword) => (
                  <span key={keyword} className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs text-[var(--muted)]">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {checklist.length > 0 && (
            <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <h2 className="text-base font-extrabold text-[var(--primary-strong)]">Fact Checklist</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
                {checklist.map((item) => (
                  <li key={item}>{item.replace(/^[-*]\s*/, '')}</li>
                ))}
              </ul>
            </div>
          )}

          {citations.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-extrabold text-[var(--primary-strong)]">Recherche-Quellen</h2>
              <div className="mt-3 space-y-3">
                {citations.map((citation) => (
                  <div key={citation.url} className="rounded-xl border border-[var(--border)] bg-white p-4">
                    <p className="font-semibold text-[var(--foreground)]">{citation.title}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{citation.snippet}</p>
                    <div className="mt-3">
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        title={citation.url}
                        className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-white"
                      >
                        Quelle oeffnen
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
            <a
              href={article.originalUrl}
              target="_blank"
              rel="noreferrer"
              title={article.originalUrl}
              className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5 font-semibold text-[var(--primary)] hover:bg-white"
            >
              Originalquelle oeffnen
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span>{safe}/100</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function safeParseCitations(raw: string): Array<{ title: string; url: string; snippet: string }> {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        title: String(item?.title || 'Untitled'),
        url: String(item?.url || ''),
        snippet: String(item?.snippet || ''),
      }))
      .filter((item) => item.url);
  } catch {
    return [];
  }
}

function safeParseScoreBreakdown(raw?: string | null):
  | { factuality: number; clarity: number; structure: number; seo: number; explanation: string }
  | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const factuality = Number(parsed?.factuality);
    const clarity = Number(parsed?.clarity);
    const structure = Number(parsed?.structure);
    const seo = Number(parsed?.seo);
    const explanation = String(parsed?.explanation || '').trim();

    if (![factuality, clarity, structure, seo].every((v) => Number.isFinite(v))) {
      return null;
    }

    const values = [factuality, clarity, structure, seo];
    const usesTenScale = values.every((v) => v >= 0 && v <= 10);
    const normalize = (value: number) => (usesTenScale ? value * 10 : value);

    return {
      factuality: normalize(factuality),
      clarity: normalize(clarity),
      structure: normalize(structure),
      seo: normalize(seo),
      explanation: explanation || 'Kein Detailkommentar vorhanden.',
    };
  } catch {
    return null;
  }
}

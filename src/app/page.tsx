import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ResearchPanel from './ResearchPanel';
import PageContainer from '@/components/ui/PageContainer';

export const revalidate = 60;

type ArticleRow = {
  id: string;
  slug: string;
  generatedTitle: string | null;
  originalTitle: string;
  generatedExcerpt: string | null;
  generatedContent: string | null;
  qualityScore: number | null;
  createdAt: Date;
  publishedAt: Date | null;
  source: { name: string };
  author: { name: string } | null;
};

type ArticleTableProps = {
  articles: ArticleRow[];
  dateLabel: string;
  dateValue: (article: ArticleRow) => string;
  actionLabel: string;
  emptyMessage: string;
};

// Shared card+table rendering for "Review" and "Published" - both used to be
// two near-identical hand-copied tables (title/quelle/autor/score/date/aktion)
// that clipped instead of scrolling on narrow viewports.
function ArticleTable({ articles, dateLabel, dateValue, actionLabel, emptyMessage }: ArticleTableProps) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {articles.map((article) => (
          <article key={article.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <Link href={`/article/${article.slug}`} className="text-sm font-semibold text-[var(--foreground)] hover:underline">
              {article.generatedTitle || article.originalTitle}
            </Link>
            <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{article.generatedExcerpt || article.generatedContent}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">{article.source.name}</span>
              <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">{article.author?.name || 'System-Redaktion'}</span>
              <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">Score: {article.qualityScore ?? '-'}</span>
              <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">
                {dateLabel}: {dateValue(article)}
              </span>
            </div>
            <Link
              href={`/article/${article.slug}`}
              className="mt-3 inline-flex rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)]"
            >
              {actionLabel}
            </Link>
          </article>
        ))}
        {articles.length === 0 && (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            {emptyMessage}
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="min-w-full table-fixed">
          <thead className="bg-[var(--surface-alt)]">
            <tr>
              <th className="w-[46%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Titel</th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Quelle</th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Autor</th>
              <th className="w-[10%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Score</th>
              <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{dateLabel}</th>
              <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-t border-[var(--border)] align-top hover:bg-white">
                <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                  <Link href={`/article/${article.slug}`} className="font-semibold hover:underline">
                    {article.generatedTitle || article.originalTitle}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{article.generatedExcerpt || article.generatedContent}</p>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{article.source.name}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{article.author?.name || 'System-Redaktion'}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[var(--foreground)]">{article.qualityScore ?? '-'}</td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">{dateValue(article)}</td>
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={`/article/${article.slug}`}
                    className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)]"
                  >
                    {actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function Home() {
  const [reviewArticles, publishedArticles] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'REVIEW',
        generatedTitle: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      include: { source: true, author: true },
      take: 20,
    }),
    prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        generatedTitle: { not: null },
        generatedContent: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      include: { source: true, author: true },
      take: 10,
    }),
  ]);

  return (
    <main className="text-[var(--foreground)]">
      <PageContainer>
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-extrabold text-[var(--primary-strong)]">1. Hot Topics</h2>
          <ResearchPanel />
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-extrabold text-[var(--primary-strong)]">2. Artikel im Review</h2>
          <ArticleTable
            articles={reviewArticles}
            dateLabel="Erstellt"
            dateValue={(article) => new Date(article.createdAt).toLocaleDateString()}
            actionLabel="Pruefen"
            emptyMessage="Keine Artikel im Review."
          />
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-extrabold text-[var(--primary-strong)]">3. Zuletzt publizierte Artikel</h2>
          <ArticleTable
            articles={publishedArticles}
            dateLabel="Datum"
            dateValue={(article) => (article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : '-')}
            actionLabel="Lesen"
            emptyMessage="Noch keine publizierten Artikel gefunden."
          />
        </section>
      </PageContainer>
    </main>
  );
}

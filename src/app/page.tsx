import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ResearchPanel from './ResearchPanel';

export const revalidate = 60;

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
      <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-extrabold text-[var(--primary-strong)]">1. Hot Topics</h2>
          <ResearchPanel />
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-extrabold text-[var(--primary-strong)]">2. Artikel im Review</h2>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full table-fixed">
              <thead className="bg-[var(--surface-alt)]">
                <tr>
                  <th className="w-[46%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Titel</th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Quelle</th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Autor</th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Score</th>
                  <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Erstellt</th>
                  <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {reviewArticles.map((article) => (
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
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{new Date(article.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/article/${article.slug}`} className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                        Pruefen
                      </Link>
                    </td>
                  </tr>
                ))}
                {reviewArticles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted)]">Keine Artikel im Review.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-extrabold text-[var(--primary-strong)]">3. Zuletzt publizierte Artikel</h2>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full table-fixed">
              <thead className="bg-[var(--surface-alt)]">
                <tr>
                  <th className="w-[46%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Titel</th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Quelle</th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Autor</th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Score</th>
                  <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Datum</th>
                  <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {publishedArticles.map((article) => (
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
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/article/${article.slug}`} className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                        Lesen
                      </Link>
                    </td>
                  </tr>
                ))}
                {publishedArticles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted)]">Noch keine publizierten Artikel gefunden.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

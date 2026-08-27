import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { ArticleStatus, Prisma } from '@prisma/client';
import DeleteConfirmButton from '@/app/admin/DeleteConfirmButton';

function formatDate(value: Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function statusBadge(status: ArticleStatus) {
  if (status === 'PUBLISHED') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (status === 'REVIEW') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (status === 'FAILED') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function parseScoreExplanation(raw?: string | null) {
  if (!raw) return '-';
  try {
    const parsed = JSON.parse(raw);
    const explanation = String(parsed?.explanation || '').trim();
    return explanation || '-';
  } catch {
    return '-';
  }
}

type SearchParams = {
  q?: string;
  author?: string;
  from?: string;
  to?: string;
  scoreMin?: string;
  sort?: string;
};

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  async function updateArticleStatusAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    const statusRaw = String(formData.get('status') || '').trim();

    if (!id) return;

    const status: ArticleStatus =
      statusRaw === 'PUBLISHED' || statusRaw === 'FAILED' || statusRaw === 'REVIEW'
        ? (statusRaw as ArticleStatus)
        : 'REVIEW';

    await prisma.article.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/articles');
  }

  async function deleteArticleAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    if (!id) return;

    await prisma.article.delete({ where: { id } });

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/articles');
  }

  const filters = await searchParams;

  const query = (filters.q || '').trim();
  const authorFilter = (filters.author || '').trim();
  const fromDate = (filters.from || '').trim();
  const toDate = (filters.to || '').trim();
  const scoreMinRaw = Number(filters.scoreMin || '');
  const scoreMin = Number.isFinite(scoreMinRaw) ? Math.max(0, Math.min(100, Math.trunc(scoreMinRaw))) : null;
  const sort = (filters.sort || 'date_desc').trim();

  const where: Prisma.ArticleWhereInput = {};

  if (query) {
    where.OR = [
      { generatedTitle: { contains: query } },
      { originalTitle: { contains: query } },
      { source: { name: { contains: query } } },
    ];
  }

  if (authorFilter && authorFilter !== 'all') {
    where.authorId = authorFilter;
  }

  if (scoreMin !== null) {
    where.qualityScore = { gte: scoreMin };
  }

  if (fromDate || toDate) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      createdAt.gte = start;
    }

    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }

    where.createdAt = createdAt;
  }

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    sort === 'name_asc'
      ? [{ generatedTitle: 'asc' }, { originalTitle: 'asc' }]
      : sort === 'name_desc'
        ? [{ generatedTitle: 'desc' }, { originalTitle: 'desc' }]
        : sort === 'date_asc'
          ? [{ createdAt: 'asc' }]
          : sort === 'score_desc'
            ? [{ qualityScore: 'desc' }, { createdAt: 'desc' }]
            : sort === 'score_asc'
              ? [{ qualityScore: 'asc' }, { createdAt: 'desc' }]
              : sort === 'author_asc'
                ? [{ author: { name: 'asc' } }, { createdAt: 'desc' }]
                : sort === 'author_desc'
                  ? [{ author: { name: 'desc' } }, { createdAt: 'desc' }]
                  : [{ createdAt: 'desc' }];

  const [authors, articles] = await Promise.all([
    prisma.authorProfile.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.article.findMany({
      where,
      orderBy,
      include: { source: true, author: true },
      take: 100,
    }),
  ]);

  const filteredCount = articles.length;

  const publishedCount = articles.filter((article) => article.status === 'PUBLISHED').length;
  const reviewCount = articles.filter((article) => article.status === 'REVIEW').length;
  const failedCount = articles.filter((article) => article.status === 'FAILED').length;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-sm text-[var(--muted)]">Lesen, Status steuern und Scoring mit Begruendung nachvollziehen.</p>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center">
              <p className="font-semibold text-[var(--muted)]">Treffer</p>
              <p className="text-base font-extrabold text-[var(--primary-strong)]">{filteredCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center">
              <p className="font-semibold text-[var(--muted)]">Publish</p>
              <p className="text-base font-extrabold text-emerald-700">{publishedCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center">
              <p className="font-semibold text-[var(--muted)]">Review</p>
              <p className="text-base font-extrabold text-amber-700">{reviewCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center">
              <p className="font-semibold text-[var(--muted)]">Failed</p>
              <p className="text-base font-extrabold text-rose-700">{failedCount}</p>
            </div>
          </div>
        </div>

        <form method="GET" className="mt-4 grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Name</label>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Titel oder Quelle"
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Autor</label>
            <select
              name="author"
              defaultValue={authorFilter || 'all'}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            >
              <option value="all">Alle</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>{author.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Von</label>
            <input
              type="date"
              name="from"
              defaultValue={fromDate}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Bis</label>
            <input
              type="date"
              name="to"
              defaultValue={toDate}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </div>

          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Min Score</label>
            <input
              type="number"
              name="scoreMin"
              min={0}
              max={100}
              defaultValue={scoreMin ?? ''}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Sortierung</label>
            <select
              name="sort"
              defaultValue={sort}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] focus:ring-2"
            >
              <option value="date_desc">Datum neu bis alt</option>
              <option value="date_asc">Datum alt bis neu</option>
              <option value="name_asc">Name A bis Z</option>
              <option value="name_desc">Name Z bis A</option>
              <option value="score_desc">Score hoch bis niedrig</option>
              <option value="score_asc">Score niedrig bis hoch</option>
              <option value="author_asc">Autor A bis Z</option>
              <option value="author_desc">Autor Z bis A</option>
            </select>
          </div>

          <div className="md:col-span-12 flex flex-wrap items-center justify-end gap-2">
            <Link href="/admin/articles" className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
              Reset
            </Link>
            <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              Filtern
            </button>
          </div>
        </form>
      </div>

      <div className="mt-4 space-y-3 md:hidden">
        {articles.map((article) => {
          const explanation = parseScoreExplanation(article.scoreBreakdown);

          return (
            <article key={article.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusBadge(article.status)}`}>
                  {article.status}
                </span>
                <span className="text-xs text-[var(--muted)]">{formatDate(article.publishedAt || article.createdAt)}</span>
              </div>

              <Link href={`/article/${article.slug}`} className="text-sm font-semibold text-[var(--foreground)] hover:underline">
                {article.generatedTitle || article.originalTitle}
              </Link>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">{article.source.name}</span>
                <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">{article.author?.name || 'System-Redaktion'}</span>
                <span className="rounded-full bg-white px-2 py-1 text-[var(--muted)]">Score: {article.qualityScore ?? '-'}</span>
              </div>

              <p className="mt-2 text-xs text-[var(--muted)]">{explanation}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/article/${article.slug}`} className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                  Lesen
                </Link>
                <form action={updateArticleStatusAction}>
                  <input type="hidden" name="id" value={article.id} />
                  <input type="hidden" name="status" value="PUBLISHED" />
                  <button
                    type="submit"
                    disabled={article.status === 'PUBLISHED'}
                    className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)] disabled:opacity-50"
                  >
                    Publish
                  </button>
                </form>
                <form action={updateArticleStatusAction}>
                  <input type="hidden" name="id" value={article.id} />
                  <input type="hidden" name="status" value="REVIEW" />
                  <button
                    type="submit"
                    disabled={article.status === 'REVIEW'}
                    className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)] disabled:opacity-50"
                  >
                    Review
                  </button>
                </form>
                <form action={deleteArticleAction}>
                  <input type="hidden" name="id" value={article.id} />
                  <DeleteConfirmButton message="Moechtest du diesen Artikel wirklich loeschen?" />
                </form>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="min-w-full table-fixed">
          <thead className="bg-[var(--surface-alt)]">
            <tr>
              <th className="w-[36%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Titel</th>
              <th className="w-[11%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Quelle</th>
              <th className="w-[11%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Autor</th>
              <th className="w-[9%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Status</th>
              <th className="w-[8%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Score</th>
              <th className="w-[15%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Begruendung</th>
              <th className="w-[10%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const explanation = parseScoreExplanation(article.scoreBreakdown);

              return (
                <tr key={article.id} className="border-t border-[var(--border)] align-top transition hover:bg-white">
                  <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                    <Link href={`/article/${article.slug}`} className="font-semibold hover:underline">
                      {article.generatedTitle || article.originalTitle}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(article.publishedAt || article.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)]">{article.source.name}</td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)]">{article.author?.name || 'System-Redaktion'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusBadge(article.status)}`}>
                      {article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--foreground)]">{article.qualityScore ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">{explanation}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col items-start gap-1">
                      <Link href={`/article/${article.slug}`} className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                        Lesen
                      </Link>
                      <form action={updateArticleStatusAction}>
                        <input type="hidden" name="id" value={article.id} />
                        <input type="hidden" name="status" value="PUBLISHED" />
                        <button
                          type="submit"
                          disabled={article.status === 'PUBLISHED'}
                          className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)] disabled:opacity-50"
                        >
                          Publish
                        </button>
                      </form>
                      <form action={updateArticleStatusAction}>
                        <input type="hidden" name="id" value={article.id} />
                        <input type="hidden" name="status" value="REVIEW" />
                        <button
                          type="submit"
                          disabled={article.status === 'REVIEW'}
                          className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)] disabled:opacity-50"
                        >
                          Review
                        </button>
                      </form>
                      <form action={deleteArticleAction}>
                        <input type="hidden" name="id" value={article.id} />
                        <DeleteConfirmButton message="Moechtest du diesen Artikel wirklich loeschen?" />
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {articles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--muted)]">Keine Artikel fuer die aktuellen Filter gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

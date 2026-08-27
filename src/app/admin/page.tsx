import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function AdminOverviewPage() {
  const [sourceCount, authorCount, radarBacklog, publishedCount, latestRuns] = await Promise.all([
    prisma.source.count({ where: { active: true } }),
    prisma.authorProfile.count({ where: { active: true } }),
    prisma.radarQueueItem.count({ where: { status: { in: ['ASSIGNED', 'WRITING'] } } }),
    prisma.article.count({ where: { status: 'PUBLISHED' } }),
    prisma.jobRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        radarItems: { select: { id: true, title: true }, take: 1 },
      },
      take: 8,
    }),
  ]);

  const cards = [
    { label: 'Aktive Quellen', value: sourceCount, href: '/admin/sources' },
    { label: 'Aktive Autoren', value: authorCount, href: '/admin/authors' },
    { label: 'Radar-Backlog', value: radarBacklog, href: '/admin/radar' },
    { label: 'Published Artikel', value: publishedCount, href: '/admin/articles' },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
        Kontrolliere Redaktion, News Radar und Quellen an einem Ort.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{card.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-[var(--primary-strong)]">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-extrabold text-[var(--primary-strong)]">Letzte Job-Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[var(--surface-alt)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Zeit</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Job</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Items</th>
              </tr>
            </thead>
            <tbody>
              {latestRuns.map((run) => (
                <tr key={run.id} className="border-t border-[var(--border)]">
                  <td className="px-6 py-3 text-sm text-[var(--muted)]">{new Date(run.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-[var(--foreground)]">{run.radarItems[0]?.title || run.topic || 'Ad-hoc Job'}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-[var(--foreground)]">{run.status}</td>
                  <td className="px-6 py-3 text-sm text-[var(--muted)]">{run.processed} / {run.totalItems}</td>
                </tr>
              ))}
              {latestRuns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-[var(--muted)]">Noch keine Job-Runs vorhanden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

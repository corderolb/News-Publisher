import { revalidatePath } from 'next/cache';
import SourceFormOverlay from '@/app/admin/SourceFormOverlay';
import { prisma } from '@/lib/prisma';
import PageContainer from '@/components/ui/PageContainer';
import Badge from '@/components/ui/Badge';

export default async function SourcesPage() {
  async function addSourceAction(formData: FormData) {
    'use server';

    const name = String(formData.get('name') || '').trim();
    const url = String(formData.get('url') || '').trim();
    const category = String(formData.get('category') || '').trim();
    const typeInput = String(formData.get('type') || 'RSS').toUpperCase();

    if (!name || !url) return;

    const type = typeInput === 'HTML' ? 'HTML' : 'RSS';

    await prisma.source.create({
      data: {
        name,
        url,
        category: category || 'general',
        type,
        active: true,
      },
    });

    revalidatePath('/admin');
    revalidatePath('/admin/sources');
  }

  async function updateSourceAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '');
    const name = String(formData.get('name') || '').trim();
    const url = String(formData.get('url') || '').trim();
    const category = String(formData.get('category') || '').trim();
    const typeInput = String(formData.get('type') || 'RSS').toUpperCase();

    if (!id || !name || !url) return;

    const type = typeInput === 'HTML' ? 'HTML' : 'RSS';

    await prisma.source.update({
      where: { id },
      data: {
        name,
        url,
        category: category || 'general',
        type,
      },
    });

    revalidatePath('/admin');
    revalidatePath('/admin/sources');
  }

  async function toggleSourceActiveAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '');
    if (!id) return;

    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) return;

    await prisma.source.update({
      where: { id },
      data: { active: !source.active },
    });

    revalidatePath('/admin');
    revalidatePath('/admin/sources');
  }

  const sources = await prisma.source.findMany({ orderBy: [{ createdAt: 'desc' }] });

  function renderSourceActions(source: (typeof sources)[number]) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <SourceFormOverlay
          action={updateSourceAction}
          source={{
            id: source.id,
            name: source.name,
            url: source.url,
            category: source.category,
            type: source.type,
          }}
        />
        <form action={toggleSourceActiveAction}>
          <input type="hidden" name="id" value={source.id} />
          <button type="submit" className="font-semibold text-[var(--primary)] hover:underline">
            {source.active ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">Quellen mit Typ, Kategorie und Abruflimit verwalten.</p>
        <SourceFormOverlay action={addSourceAction} />
      </div>

      <div className="space-y-3 md:hidden">
        {sources.map((source) => (
          <article key={source.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-[var(--foreground)]">{source.name}</p>
              <Badge tone={source.active ? 'success' : 'neutral'}>{source.active ? 'Aktiv' : 'Inaktiv'}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full bg-white px-2 py-1">{source.type}</span>
              <span className="rounded-full bg-white px-2 py-1">{source.category}</span>
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-alt)]"
            >
              Link oeffnen
            </a>
            <div className="mt-3">{renderSourceActions(source)}</div>
          </article>
        ))}
        {sources.length === 0 && (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Keine Quellen vorhanden.
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="min-w-full">
          <thead className="bg-[var(--surface-alt)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Quelle</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Typ</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Kategorie</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{source.name}</p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-alt)]"
                  >
                    Link oeffnen
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{source.type}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{source.category}</td>
                <td className="px-4 py-3 text-sm">
                  <Badge tone={source.active ? 'success' : 'neutral'}>{source.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                </td>
                <td className="px-4 py-3 text-sm">{renderSourceActions(source)}</td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Keine Quellen vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}

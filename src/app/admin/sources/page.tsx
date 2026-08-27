import { revalidatePath } from 'next/cache';
import SourceEditOverlay from '@/app/admin/SourceEditOverlay';
import SourceOverlay from '@/app/admin/SourceOverlay';
import { prisma } from '@/lib/prisma';

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

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">Quellen mit Typ, Kategorie und Abruflimit verwalten.</p>
        <SourceOverlay addSourceAction={addSourceAction} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
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
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {source.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <SourceEditOverlay
                      source={{
                        id: source.id,
                        name: source.name,
                        url: source.url,
                        category: source.category,
                        type: source.type,
                      }}
                      updateSourceAction={updateSourceAction}
                    />
                    <form action={toggleSourceActiveAction}>
                      <input type="hidden" name="id" value={source.id} />
                      <button type="submit" className="font-semibold text-[var(--primary)] hover:underline">
                        {source.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </form>
                  </div>
                </td>
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
    </div>
  );
}

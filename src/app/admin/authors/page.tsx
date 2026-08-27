import { revalidatePath } from 'next/cache';
import AuthorEditOverlay from '@/app/admin/AuthorEditOverlay';
import AuthorOverlay from '@/app/admin/AuthorOverlay';
import { prisma } from '@/lib/prisma';

export default async function AuthorsPage() {
  async function addAuthorAction(formData: FormData) {
    'use server';

    const name = String(formData.get('name') || '').trim();
    const tone = String(formData.get('tone') || '').trim();
    const bio = String(formData.get('bio') || '').trim();
    const instructions = String(formData.get('instructions') || '').trim();
    const isDefault = formData.get('isDefault') === 'on';

    if (!name || !tone) return;

    await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.authorProfile.updateMany({ data: { isDefault: false } });
      }

      await tx.authorProfile.create({
        data: {
          name,
          tone,
          bio: bio || null,
          instructions: instructions || null,
          isDefault,
          active: true,
        },
      });
    });

    revalidatePath('/admin');
    revalidatePath('/admin/authors');
  }

  async function updateAuthorAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '');
    const name = String(formData.get('name') || '').trim();
    const tone = String(formData.get('tone') || '').trim();
    const bio = String(formData.get('bio') || '').trim();
    const instructions = String(formData.get('instructions') || '').trim();

    if (!id || !name || !tone) return;

    await prisma.authorProfile.update({
      where: { id },
      data: {
        name,
        tone,
        bio: bio || null,
        instructions: instructions || null,
      },
    });

    revalidatePath('/admin/authors');
  }

  async function setDefaultAuthorAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '');
    if (!id) return;

    await prisma.$transaction(async (tx) => {
      await tx.authorProfile.updateMany({ data: { isDefault: false } });
      await tx.authorProfile.update({ where: { id }, data: { isDefault: true, active: true } });
    });

    revalidatePath('/admin');
    revalidatePath('/admin/authors');
  }

  async function toggleAuthorActiveAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '');
    if (!id) return;

    const author = await prisma.authorProfile.findUnique({ where: { id } });
    if (!author) return;

    await prisma.authorProfile.update({
      where: { id },
      data: {
        active: !author.active,
        isDefault: author.active ? false : author.isDefault,
      },
    });

    revalidatePath('/admin');
    revalidatePath('/admin/authors');
  }

  const authors = await prisma.authorProfile.findMany({ orderBy: [{ createdAt: 'asc' }] });

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">Verwalte Autorenprofil, Tonalitaet, Standardzuweisung und Aktivstatus.</p>
        <AuthorOverlay addAuthorAction={addAuthorAction} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full">
          <thead className="bg-[var(--surface-alt)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Tonalitaet</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {authors.map((author) => (
              <tr key={author.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                  <p className="font-semibold">{author.name}</p>
                  {author.bio && <p className="text-xs text-[var(--muted)]">{author.bio}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{author.tone}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {author.active ? 'Aktiv' : 'Inaktiv'}
                    {author.isDefault ? ' • Standard' : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <AuthorEditOverlay
                      author={{
                        id: author.id,
                        name: author.name,
                        tone: author.tone,
                        bio: author.bio,
                        instructions: author.instructions,
                      }}
                      updateAuthorAction={updateAuthorAction}
                    />

                    <form action={setDefaultAuthorAction}>
                      <input type="hidden" name="id" value={author.id} />
                      <button
                        type="submit"
                        className="font-semibold text-[var(--primary)] hover:underline disabled:text-[var(--muted)]"
                        disabled={author.isDefault}
                      >
                        Als Standard
                      </button>
                    </form>

                    <form action={toggleAuthorActiveAction}>
                      <input type="hidden" name="id" value={author.id} />
                      <button type="submit" className="font-semibold text-[var(--primary)] hover:underline">
                        {author.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {authors.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Keine Autoren vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

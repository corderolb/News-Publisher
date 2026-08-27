import { revalidatePath } from 'next/cache';
import AuthorFormOverlay from '@/app/admin/AuthorFormOverlay';
import { prisma } from '@/lib/prisma';
import PageContainer from '@/components/ui/PageContainer';
import Badge from '@/components/ui/Badge';

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

  function renderAuthorActions(author: (typeof authors)[number]) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <AuthorFormOverlay
          action={updateAuthorAction}
          author={{
            id: author.id,
            name: author.name,
            tone: author.tone,
            bio: author.bio,
            instructions: author.instructions,
          }}
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
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">Verwalte Autorenprofil, Tonalitaet, Standardzuweisung und Aktivstatus.</p>
        <AuthorFormOverlay action={addAuthorAction} />
      </div>

      <div className="space-y-3 md:hidden">
        {authors.map((author) => (
          <article key={author.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--foreground)]">{author.name}</p>
                {author.bio && <p className="mt-0.5 text-xs text-[var(--muted)]">{author.bio}</p>}
              </div>
              <Badge tone={author.active ? 'success' : 'neutral'}>
                {author.active ? 'Aktiv' : 'Inaktiv'}
                {author.isDefault ? ' • Standard' : ''}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{author.tone}</p>
            <div className="mt-3">
              {renderAuthorActions(author)}
            </div>
          </article>
        ))}
        {authors.length === 0 && (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Keine Autoren vorhanden.
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] md:block">
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
                  <Badge tone={author.active ? 'success' : 'neutral'}>
                    {author.active ? 'Aktiv' : 'Inaktiv'}
                    {author.isDefault ? ' • Standard' : ''}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  {renderAuthorActions(author)}
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
    </PageContainer>
  );
}

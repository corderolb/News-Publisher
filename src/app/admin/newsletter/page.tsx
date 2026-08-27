import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  listNewsletterConfigs,
  buildFallbackDigest,
  renderDigestHtml,
  dispatchDigest,
  sendTestDigest,
  parseRecipients,
  createNewsletterConfig,
  updateNewsletterConfig,
  deleteNewsletterConfig,
  isSmtpConfigured,
  type NewsletterCadenceValue,
} from '@/lib/newsletter';
import NewsletterOverlay from '@/app/admin/newsletter/NewsletterOverlay';
import NewsletterEditForm from '@/app/admin/newsletter/NewsletterEditForm';

type NewsletterSearchParams = {
  notice?: string;
  error?: string;
};

async function resolveSiteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const headerList = await headers();
  const host = headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}` : '';
}

function formatDateTime(value?: Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function parseCadence(raw: FormDataEntryValue | null): NewsletterCadenceValue {
  const value = String(raw || '').trim();
  return value === 'DAILY' || value === 'MONTHLY' ? value : 'WEEKLY';
}

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<NewsletterSearchParams> }) {
  async function createAction(formData: FormData) {
    'use server';

    const name = String(formData.get('name') || '').trim() || 'Newsletter';
    const active = formData.get('active') === 'on';
    const cadence = parseCadence(formData.get('cadence'));
    const sendHour = String(formData.get('sendHour') || '08:00').trim() || '08:00';
    const recipients = String(formData.get('recipients') || '').trim();
    const subjectTemplate = String(formData.get('subjectTemplate') || 'Deine Top-Artikel').trim() || 'Deine Top-Artikel';
    const topNRaw = Number(formData.get('topN') || 5);
    const topN = Number.isFinite(topNRaw) ? Math.max(1, Math.min(20, Math.trunc(topNRaw))) : 5;

    let redirectTarget = '/admin/newsletter?notice=Newsletter+angelegt';
    try {
      await createNewsletterConfig({ name, active, cadence, sendHour, recipients, subjectTemplate, topN });
      revalidatePath('/admin/newsletter');
    } catch (err) {
      console.error('[admin/newsletter] createAction failed', err);
      redirectTarget = '/admin/newsletter?error=Newsletter+konnte+nicht+angelegt+werden';
    }

    redirect(redirectTarget);
  }

  async function updateAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    if (!id) return;

    const name = String(formData.get('name') || '').trim() || 'Newsletter';
    const active = formData.get('active') === 'on';
    const cadence = parseCadence(formData.get('cadence'));
    const sendHour = String(formData.get('sendHour') || '08:00').trim() || '08:00';
    const recipients = String(formData.get('recipients') || '').trim();
    const subjectTemplate = String(formData.get('subjectTemplate') || 'Deine Top-Artikel').trim() || 'Deine Top-Artikel';
    const topNRaw = Number(formData.get('topN') || 5);
    const topN = Number.isFinite(topNRaw) ? Math.max(1, Math.min(20, Math.trunc(topNRaw))) : 5;

    let redirectTarget = '/admin/newsletter?notice=Newsletter+gespeichert';
    try {
      await updateNewsletterConfig(id, { name, active, cadence, sendHour, recipients, subjectTemplate, topN });
      revalidatePath('/admin/newsletter');
    } catch (err) {
      console.error('[admin/newsletter] updateAction failed', err);
      redirectTarget = '/admin/newsletter?error=Newsletter+konnte+nicht+gespeichert+werden';
    }

    redirect(redirectTarget);
  }

  async function toggleAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    if (!id) return;

    let redirectTarget = '/admin/newsletter?notice=Status+geaendert';
    try {
      const config = await prisma.newsletterConfig.findUnique({ where: { id } });
      if (config) {
        await updateNewsletterConfig(id, {
          name: config.name,
          active: !config.active,
          cadence: config.cadence as NewsletterCadenceValue,
          sendHour: config.sendHour,
          recipients: config.recipients,
          subjectTemplate: config.subjectTemplate,
          topN: config.topN,
        });
      }
      revalidatePath('/admin/newsletter');
    } catch (err) {
      console.error('[admin/newsletter] toggleAction failed', err);
      redirectTarget = '/admin/newsletter?error=Status+konnte+nicht+geaendert+werden';
    }

    redirect(redirectTarget);
  }

  async function deleteAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    if (!id) return;

    let redirectTarget = '/admin/newsletter?notice=Newsletter+geloescht';
    try {
      await deleteNewsletterConfig(id);
      revalidatePath('/admin/newsletter');
    } catch (err) {
      console.error('[admin/newsletter] deleteAction failed', err);
      redirectTarget = '/admin/newsletter?error=Newsletter+konnte+nicht+geloescht+werden';
    }

    redirect(redirectTarget);
  }

  async function sendNowAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    if (!id) return;
    const siteUrl = await resolveSiteUrl();

    let redirectTarget = '/admin/newsletter?notice=Newsletter+wurde+versendet';
    try {
      const result = await dispatchDigest(id, siteUrl);
      if (!result.ok) {
        redirectTarget = `/admin/newsletter?error=${encodeURIComponent(result.error)}`;
      }
      revalidatePath('/admin/newsletter');
    } catch (err) {
      console.error('[admin/newsletter] sendNowAction failed', err);
      redirectTarget = '/admin/newsletter?error=Versand+fehlgeschlagen';
    }

    redirect(redirectTarget);
  }

  async function sendTestAction(formData: FormData) {
    'use server';

    const id = String(formData.get('id') || '').trim();
    const testEmail = String(formData.get('testEmail') || '').trim();
    const siteUrl = await resolveSiteUrl();

    let redirectTarget = `/admin/newsletter?notice=${encodeURIComponent(`Test-Mail an ${testEmail} gesendet`)}`;
    try {
      if (!id || !testEmail) {
        redirectTarget = '/admin/newsletter?error=Bitte+eine+Test-Adresse+angeben';
      } else {
        const result = await sendTestDigest(id, testEmail, siteUrl);
        if (!result.ok) {
          redirectTarget = `/admin/newsletter?error=${encodeURIComponent(result.error)}`;
        }
      }
    } catch (err) {
      console.error('[admin/newsletter] sendTestAction failed', err);
      redirectTarget = '/admin/newsletter?error=Test-Mail+konnte+nicht+gesendet+werden';
    }

    redirect(redirectTarget);
  }

  const pageParams = await searchParams;
  const notice = pageParams.notice ? decodeURIComponent(pageParams.notice) : null;
  const error = pageParams.error ? decodeURIComponent(pageParams.error) : null;

  const [configs, sends, smtpConfigured, siteUrl] = await Promise.all([
    listNewsletterConfigs(),
    prisma.newsletterSend.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { config: { select: { name: true } } },
    }),
    Promise.resolve(isSmtpConfigured()),
    resolveSiteUrl(),
  ]);

  const cards = await Promise.all(
    configs.map(async (config) => {
      const { articles, intro } = await buildFallbackDigest(config);
      const html = renderDigestHtml({ subject: config.subjectTemplate, articles, intro, siteUrl });
      return { config, articleCount: articles.length, html };
    })
  );

  const activeCount = configs.filter((c) => c.active).length;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--primary-strong)] via-[var(--primary)] to-[var(--accent)] px-6 py-5 text-white">
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="max-w-2xl text-sm text-white/85">
                Verschickt automatisch die Top-Artikel als HTML-Mail — taeglich, woechentlich oder monatlich.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {activeCount} von {configs.length} aktiv
            </span>
          </div>
        </div>

        <div className="p-6">
          {!smtpConfigured && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">SMTP ist noch nicht konfiguriert.</p>
              <p className="mt-1 text-xs text-amber-800">
                Setze <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_HOST</code>,{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_USER</code>,{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_PASS</code> (oder{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_PASSWORD</code>) in der .env, um Versand zu
                aktivieren. Optional: <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_PORT</code>,{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_SECURE</code>,{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5">SMTP_FROM</code>/
                <code className="rounded bg-amber-100 px-1 py-0.5">SENDER_EMAIL</code>,{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5">SENDER_NAME</code>.
              </p>
            </div>
          )}

          {notice && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {error}
            </div>
          )}

          <div className="mb-6 flex justify-end">
            <NewsletterOverlay createAction={createAction} />
          </div>

          <ul className="space-y-3">
            {cards.map(({ config, articleCount, html }) => (
              <li key={config.id}>
                <NewsletterEditForm
                  config={config}
                  previewHtml={html}
                  articleCount={articleCount}
                  recipientCount={parseRecipients(config.recipients).length}
                  updateAction={updateAction}
                  toggleAction={toggleAction}
                  deleteAction={deleteAction}
                  sendNowAction={sendNowAction}
                  sendTestAction={sendTestAction}
                />
              </li>
            ))}
            {configs.length === 0 && (
              <li className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                Noch kein Newsletter angelegt.
              </li>
            )}
          </ul>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--primary-strong)]">Versand-Historie</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--surface-alt)]">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Zeit</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Newsletter</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Betreff</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Empfaenger</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.map((send) => (
                    <tr key={send.id} className="border-t border-[var(--border)]">
                      <td className="px-5 py-3 text-sm text-[var(--muted)]">{formatDateTime(send.createdAt)}</td>
                      <td className="px-5 py-3 text-sm text-[var(--foreground)]">{send.config?.name || '-'}</td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                            send.status === 'SENT'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}
                          title={send.error || undefined}
                        >
                          {send.status === 'SENT' ? 'Versendet' : 'Fehlgeschlagen'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--foreground)]">{send.subject}</td>
                      <td className="px-5 py-3 text-sm text-[var(--muted)]">{send.recipients || '-'}</td>
                    </tr>
                  ))}
                  {sends.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--muted)]">
                        Noch kein Newsletter versendet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

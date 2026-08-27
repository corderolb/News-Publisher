import nodemailer from "nodemailer";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { parseRunTimes } from "@/lib/schedule";
import { renderPrompt } from "@/lib/prompts";
import { resolvePrimaryModel } from "@/lib/llm-settings";

function extractJsonObject(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) return null;
  return text.slice(first, last + 1);
}

const CADENCE_LABEL_DE: Record<NewsletterCadenceValue, string> = {
  DAILY: "taeglichen",
  WEEKLY: "woechentlichen",
  MONTHLY: "monatlichen",
};

export type NewsletterCadenceValue = "DAILY" | "WEEKLY" | "MONTHLY";

const CADENCE_PERIOD_MS: Record<NewsletterCadenceValue, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

// Next send time for a given cadence: DAILY/WEEKLY just advance by their
// period at the configured hour; MONTHLY jumps to the 1st of next month at
// that hour, sidestepping "Jan 31 -> Feb 31" day-of-month edge cases.
export function computeNextNewsletterSendAt(
  cadence: NewsletterCadenceValue,
  sendHour: string,
  from: Date = new Date()
): Date {
  const [time] = parseRunTimes(sendHour);
  const next = new Date(from);

  if (cadence === "MONTHLY") {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setHours(time.hour, time.minute, 0, 0);
    return next;
  }

  const days = cadence === "WEEKLY" ? 7 : 1;
  next.setDate(next.getDate() + days);
  next.setHours(time.hour, time.minute, 0, 0);
  return next;
}

export type DigestArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  qualityScore: number | null;
  publishedAt: Date | null;
};

// Candidate pool for the period the cadence covers, ranked by quality score
// as a starting order (curateDigestWithAI below may re-rank/trim it further).
// Includes REVIEW alongside PUBLISHED: most setups gate publishing behind a
// manual review step, and a digest that only ever sees PUBLISHED content
// stays permanently empty until every single article is manually flipped.
// REVIEW articles have no publishedAt yet, so they're windowed by createdAt.
export async function loadDigestArticles(cadence: NewsletterCadenceValue, poolSize: number): Promise<DigestArticle[]> {
  const since = new Date(Date.now() - CADENCE_PERIOD_MS[cadence]);

  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { status: "PUBLISHED", publishedAt: { gte: since } },
        { status: "REVIEW", createdAt: { gte: since } },
      ],
    },
    orderBy: [{ qualityScore: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(50, poolSize)),
    select: { id: true, slug: true, generatedTitle: true, originalTitle: true, generatedExcerpt: true, qualityScore: true, publishedAt: true },
  });

  return articles.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.generatedTitle || article.originalTitle,
    excerpt: article.generatedExcerpt || "",
    qualityScore: article.qualityScore,
    publishedAt: article.publishedAt,
  }));
}

export type CuratedDigest = { articles: DigestArticle[]; intro: string; usedAI: boolean };

// Lets the local LLM actually assemble the digest, rather than a plain
// qualityScore sort: it picks the most newsletter-worthy stories from the
// candidate pool (weighing topic variety and news value, not just the raw
// score) and writes a short editorial intro. Falls back to a quality-score
// sort with no intro if the model is unavailable or returns something
// unusable - same graceful-degradation pattern as the embedding fallback.
export async function curateDigestWithAI(
  candidates: DigestArticle[],
  topN: number,
  cadence: NewsletterCadenceValue
): Promise<CuratedDigest> {
  const fallback = (): CuratedDigest => ({
    articles: [...candidates].sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0)).slice(0, topN),
    intro: "",
    usedAI: false,
  });

  if (candidates.length === 0) return { articles: [], intro: "", usedAI: false };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    const input = candidates.map((a) => ({ id: a.id, title: a.title, excerpt: a.excerpt, qualityScore: a.qualityScore }));

    const prompt = await renderPrompt("newsletter-curation", {
      CADENCE_LABEL: CADENCE_LABEL_DE[cadence],
      TOP_N: String(topN),
      ARTICLES_JSON: JSON.stringify(input),
    });

    const { text } = await generateText({
      model: await resolvePrimaryModel(),
      abortSignal: controller.signal,
      prompt,
    }).finally(() => clearTimeout(timer));

    const jsonText = extractJsonObject(text);
    if (!jsonText) return fallback();

    const parsed = JSON.parse(jsonText) as { orderedIds?: string[]; intro?: string };
    if (!Array.isArray(parsed.orderedIds) || parsed.orderedIds.length === 0) return fallback();

    const byId = new Map(candidates.map((a) => [a.id, a]));
    const ordered = parsed.orderedIds
      .map((id) => byId.get(id))
      .filter((a): a is DigestArticle => Boolean(a))
      .slice(0, topN);

    if (ordered.length === 0) return fallback();

    return { articles: ordered, intro: String(parsed.intro || "").trim(), usedAI: true };
  } catch (error) {
    console.error("[newsletter] curateDigestWithAI failed, falling back to quality-score sort", (error as Error)?.message);
    return fallback();
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Email clients strip <style> blocks and ignore CSS custom properties, so
// every color here is inlined by hand rather than reusing globals.css.
export function renderDigestHtml(options: { subject: string; articles: DigestArticle[]; intro?: string; siteUrl?: string }): string {
  const { subject, articles, intro } = options;
  const siteUrl = (options.siteUrl || "").replace(/\/$/, "");

  const rows = articles
    .map(
      (article, index) => `
        <tr>
          <td style="padding:20px 0;${index > 0 ? "border-top:1px solid #e2e8f0;" : ""}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:32px;vertical-align:top;padding-top:2px;">
                  <span style="display:inline-block;width:24px;height:24px;border-radius:12px;background:#2f5fbf;color:#ffffff;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;line-height:24px;text-align:center;">${index + 1}</span>
                </td>
                <td style="vertical-align:top;">
                  <a href="${siteUrl}/article/${encodeURIComponent(article.slug)}" class="email-title" style="color:#1f2937;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;line-height:1.4;">
                    ${escapeHtml(article.title)}
                  </a>
                  ${article.excerpt ? `<p style="margin:6px 0 0;color:#64748b;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">${escapeHtml(article.excerpt)}</p>` : ""}
                  <a href="${siteUrl}/article/${encodeURIComponent(article.slug)}" style="display:inline-block;margin-top:8px;color:#2f5fbf;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-decoration:none;">Weiterlesen &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
    <style>
      /* Hybrid coding: inline styles above are the fallback for clients that
         strip <style> blocks entirely; this media query is honored by every
         modern mobile mail client (Apple Mail, Gmail app, Outlook mobile)
         and is what actually makes the "Mobile" preview mode look different
         from "Desktop" instead of just showing the same fixed table narrower. */
      @media only screen and (max-width: 600px) {
        .email-shell { width: 100% !important; border-radius: 0 !important; }
        .email-hero, .email-body, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
        .email-h1 { font-size: 19px !important; }
        .email-title { font-size: 15px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-shell" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td class="email-hero" style="background:linear-gradient(135deg,#234a96,#2f5fbf,#2b7bbb);padding:28px 32px;">
                <p style="margin:0;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Newsletter-Digest</p>
                <h1 class="email-h1" style="margin:8px 0 0;color:#ffffff;font-family:Arial,sans-serif;font-size:22px;font-weight:800;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            ${
              intro
                ? `<tr>
              <td class="email-body" style="padding:20px 32px 0;">
                <p style="margin:0;color:#334155;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;font-style:italic;">${escapeHtml(intro)}</p>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td class="email-body" style="padding:8px 32px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${
                    articles.length > 0
                      ? rows
                      : `<tr><td style="padding:24px 0;color:#64748b;font-family:Arial,sans-serif;font-size:14px;">Keine neuen Top-Artikel in diesem Zeitraum.</td></tr>`
                  }
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:20px 32px;background:#f6f8fc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#94a3b8;font-family:Arial,sans-serif;font-size:11px;">Automatisch generiert vom AI Research Tool.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type SendResult = { ok: true } | { ok: false; error: string };

// Accepts both naming conventions people reasonably reach for -
// SMTP_PASS/SMTP_FROM (what the in-app hint suggests) as well as
// SMTP_PASSWORD/SENDER_EMAIL/SENDER_NAME (common in third-party setup
// guides) - so a working .env isn't gated on guessing the exact var name.
function getSmtpEnv() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM || process.env.SENDER_EMAIL || user;
  const fromName = process.env.SENDER_NAME;

  return { host, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", user, pass, fromEmail, fromName };
}

export function isSmtpConfigured(): boolean {
  const env = getSmtpEnv();
  return Boolean(env.host && env.user && env.pass);
}

function buildTransport() {
  const env = getSmtpEnv();
  if (!env.host || !env.user || !env.pass) return null;

  return nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.secure,
    auth: { user: env.user, pass: env.pass },
  });
}

// Never throws: SMTP being unconfigured or unreachable is an expected,
// recoverable state (mirrors the LM Studio embedding fallback pattern), not
// a crash - callers surface `error` to the user instead.
export async function sendDigestEmail(options: { to: string[]; subject: string; html: string }): Promise<SendResult> {
  const transport = buildTransport();
  if (!transport) {
    return { ok: false, error: "SMTP nicht konfiguriert (SMTP_HOST, SMTP_USER, SMTP_PASS/SMTP_PASSWORD in .env setzen)." };
  }

  if (options.to.length === 0) {
    return { ok: false, error: "Keine Empfaenger konfiguriert." };
  }

  const env = getSmtpEnv();

  try {
    await transport.sendMail({
      from: env.fromName ? `"${env.fromName}" <${env.fromEmail}>` : env.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error)?.message || "Versand fehlgeschlagen" };
  }
}

export function parseRecipients(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function listNewsletterConfigs() {
  return prisma.newsletterConfig.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getNewsletterConfig(id: string) {
  return prisma.newsletterConfig.findUnique({ where: { id } });
}

export type NewsletterConfigInput = {
  name: string;
  active: boolean;
  cadence: NewsletterCadenceValue;
  sendHour: string;
  recipients: string;
  subjectTemplate: string;
  topN: number;
};

export async function createNewsletterConfig(data: NewsletterConfigInput) {
  return prisma.newsletterConfig.create({
    data: { ...data, nextSendAt: computeNextNewsletterSendAt(data.cadence, data.sendHour) },
  });
}

export async function updateNewsletterConfig(id: string, data: NewsletterConfigInput) {
  return prisma.newsletterConfig.update({
    where: { id },
    data: { ...data, nextSendAt: computeNextNewsletterSendAt(data.cadence, data.sendHour) },
  });
}

export async function deleteNewsletterConfig(id: string) {
  return prisma.newsletterConfig.delete({ where: { id } });
}

// Shared by dispatch and test-send: pools a candidate set well beyond topN
// so the AI curator has real choices to pick from, not just exactly topN
// pre-selected articles. This is what actually goes out to recipients.
export async function buildCuratedDigest(config: { cadence: string; topN: number }): Promise<CuratedDigest> {
  const cadence = config.cadence as NewsletterCadenceValue;
  const candidates = await loadDigestArticles(cadence, Math.max(config.topN * 3, 15));
  return curateDigestWithAI(candidates, config.topN, cadence);
}

// Fast, no-LLM-call variant for the admin list page: with several
// newsletters on screen, running a real AI curation pass for every single
// one on every page load would block rendering for tens of seconds. This
// gives an honest approximate preview (quality-score sort, no editorial
// intro) instantly; the real send still goes through buildCuratedDigest.
export async function buildFallbackDigest(config: { cadence: string; topN: number }): Promise<CuratedDigest> {
  const cadence = config.cadence as NewsletterCadenceValue;
  const candidates = await loadDigestArticles(cadence, config.topN);
  return { articles: candidates.slice(0, config.topN), intro: "", usedAI: false };
}

// Sends immediately regardless of schedule/active state and logs the result.
// Used by both the manual "Jetzt senden" action and the scheduler below.
export async function dispatchDigest(configId: string, siteUrl?: string): Promise<SendResult> {
  const config = await prisma.newsletterConfig.findUnique({ where: { id: configId } });
  if (!config) return { ok: false, error: "Konfiguration nicht gefunden" };

  const recipients = parseRecipients(config.recipients);
  const { articles, intro } = await buildCuratedDigest(config);
  const html = renderDigestHtml({ subject: config.subjectTemplate, articles, intro, siteUrl });

  const result = await sendDigestEmail({ to: recipients, subject: config.subjectTemplate, html });

  await prisma.newsletterSend.create({
    data: {
      configId: config.id,
      status: result.ok ? "SENT" : "FAILED",
      recipients: recipients.join(", "),
      subject: config.subjectTemplate,
      articleIds: JSON.stringify(articles.map((a) => a.id)),
      error: result.ok ? null : result.error,
    },
  });

  if (result.ok) {
    await prisma.newsletterConfig.update({ where: { id: config.id }, data: { lastSentAt: new Date() } });
  }

  return result;
}

// Sends the current preview to a single ad-hoc address without touching the
// send log or lastSentAt - purely for verifying the template/SMTP setup.
export async function sendTestDigest(configId: string, to: string, siteUrl?: string): Promise<SendResult> {
  const config = await prisma.newsletterConfig.findUnique({ where: { id: configId } });
  if (!config) return { ok: false, error: "Konfiguration nicht gefunden" };

  const { articles, intro } = await buildCuratedDigest(config);
  const html = renderDigestHtml({ subject: `[Test] ${config.subjectTemplate}`, articles, intro, siteUrl });

  return sendDigestEmail({ to: [to], subject: `[Test] ${config.subjectTemplate}`, html });
}

// Polled from instrumentation.ts alongside the Radar scheduler. Fires every
// active newsletter whose own nextSendAt has passed - each one tracks its
// own schedule independently (a morning DAILY digest and an evening DAILY
// digest are just two separate configs with different sendHour values).
export async function runNewsletterIfDue(siteUrl?: string): Promise<void> {
  const dueConfigs = await prisma.newsletterConfig.findMany({
    where: { active: true, OR: [{ nextSendAt: null }, { nextSendAt: { lte: new Date() } }] },
  });

  for (const config of dueConfigs) {
    await dispatchDigest(config.id, siteUrl);
    const nextSendAt = computeNextNewsletterSendAt(config.cadence as NewsletterCadenceValue, config.sendHour, new Date());
    await prisma.newsletterConfig.update({ where: { id: config.id }, data: { nextSendAt } });
  }
}

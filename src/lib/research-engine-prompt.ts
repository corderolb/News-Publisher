import { renderPrompt } from "@/lib/prompts";

export type ResearchEnginePromptConfig = {
  primaryDomain: string;
  focusThemes: string[];
  domainTaxonomy: string[];
  topics: Array<{ key: string; title: string }>;
};

export type AuthorMatchPromptConfig = {
  authors: Array<{ id: string; name: string; bio: string; tone: string; instructions: string }>;
  topics: Array<{ key: string; title: string }>;
};

function listOrFallback(values: string[], fallback: string) {
  if (!Array.isArray(values) || values.length === 0) return fallback;
  return values.join(', ');
}

export async function buildResearchEngineFilterPrompt(config: ResearchEnginePromptConfig) {
  const primaryDomain = config.primaryDomain.trim() || 'Film, Serien, Schauspieler, Promi-News';
  const focusThemes = listOrFallback(config.focusThemes, 'casting, staffel, scandal, box-office');
  const domainTaxonomy = listOrFallback(
    config.domainTaxonomy,
    'Casting & Announcement, Season Renewal / Cancellation, Personal / Lifestyle, Controversy / Scandal, General News / Reviews, Other'
  );

  return renderPrompt('hot-topics-filter', {
    PRIMARY_DOMAIN: primaryDomain,
    FOCUS_THEMES: focusThemes,
    DOMAIN_TAXONOMY: domainTaxonomy,
    TOPICS_JSON: JSON.stringify(config.topics),
  });
}

export async function buildAuthorMatchPrompt(config: AuthorMatchPromptConfig) {
  const authorList = config.authors
    .map(
      (author) =>
        `- id: "${author.id}"\n  Name: ${author.name}\n  Bio: ${author.bio || '-'}\n  Tonalitaet: ${author.tone || '-'}\n  Extra-Regeln: ${author.instructions || '-'}`
    )
    .join('\n\n');

  return renderPrompt('author-topic-match', {
    AUTHOR_LIST: authorList,
    TOPICS_JSON: JSON.stringify(config.topics),
  });
}

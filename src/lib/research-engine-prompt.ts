import { renderPrompt } from "@/lib/prompts";

export type ResearchEnginePromptConfig = {
  primaryDomain: string;
  focusThemes: string[];
  domainTaxonomy: string[];
  topics: Array<{ key: string; title: string }>;
};

export type AuthorRosterEntry = { id: string; name: string; bio: string; tone: string; instructions: string };

export type AuthorMatchPromptConfig = {
  authorList: string;
  topics: Array<{ key: string; title: string }>;
};

// Formats the author roster (name/bio/tone/instructions per author) into the
// text block sent as AUTHOR_LIST. Pulled out so callers that invoke the
// author-match prompt multiple times in a row (e.g. once per scoring chunk)
// can build this once per run instead of re-formatting the same authors on
// every call.
export function formatAuthorRoster(authors: AuthorRosterEntry[]): string {
  return authors
    .map(
      (author) =>
        `- id: "${author.id}"\n  Name: ${author.name}\n  Bio: ${author.bio || '-'}\n  Tonalitaet: ${author.tone || '-'}\n  Extra-Regeln: ${author.instructions || '-'}`
    )
    .join('\n\n');
}

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
  return renderPrompt('author-topic-match', {
    AUTHOR_LIST: config.authorList,
    TOPICS_JSON: JSON.stringify(config.topics),
  });
}

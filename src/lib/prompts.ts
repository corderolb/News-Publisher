import { prisma } from "@/lib/prisma";
import { PROMPT_DEFINITIONS, getPromptDefinition, type PromptDefinition } from "@/lib/prompt-registry";

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, token) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? vars[token] : match
  );
}

// DB override if one exists, otherwise the built-in default from the
// registry. No row for a key is the normal, expected state - it just means
// nobody has customized that prompt yet.
export async function getEffectiveTemplate(key: string): Promise<string> {
  const definition = getPromptDefinition(key);
  if (!definition) throw new Error(`Unknown prompt key: ${key}`);

  const override = await prisma.promptTemplate.findUnique({ where: { key } }).catch(() => null);
  return override?.template ?? definition.defaultTemplate;
}

// Fetches the effective template for `key` and substitutes every {{TOKEN}}
// with the matching value from `vars`. Unknown tokens in the template (e.g.
// an admin edit introduced a typo) are left untouched rather than throwing -
// the LLM call itself is already wrapped in try/catch by every caller, so a
// malformed prompt just produces a worse completion, not a crash.
export async function renderPrompt(key: string, vars: Record<string, string>): Promise<string> {
  const template = await getEffectiveTemplate(key);
  return substitute(template, vars);
}

export type PromptAdminEntry = PromptDefinition & {
  currentTemplate: string;
  isCustomized: boolean;
  updatedAt: Date | null;
  samplePreview: string;
};

// Full list for the admin UI: registry metadata + the currently effective
// template (DB override or default) + a deterministic, non-AI preview
// rendered with the registry's documented sample values, so an admin can see
// exactly what would be sent to the model without spending an LM Studio call.
export async function listPromptsForAdmin(): Promise<PromptAdminEntry[]> {
  const overrides = await prisma.promptTemplate.findMany();
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  return PROMPT_DEFINITIONS.map((definition) => {
    const override = overrideByKey.get(definition.key);
    const currentTemplate = override?.template ?? definition.defaultTemplate;
    const sampleVars = Object.fromEntries(definition.variables.map((v) => [v.token, v.sample]));

    return {
      ...definition,
      currentTemplate,
      isCustomized: Boolean(override) && override!.template.trim() !== definition.defaultTemplate.trim(),
      updatedAt: override?.updatedAt ?? null,
      samplePreview: substitute(currentTemplate, sampleVars),
    };
  });
}

export async function updatePromptTemplate(key: string, template: string): Promise<void> {
  const definition = getPromptDefinition(key);
  if (!definition) throw new Error(`Unknown prompt key: ${key}`);

  const trimmed = template.trim();
  if (!trimmed) throw new Error("Prompt darf nicht leer sein.");

  if (trimmed === definition.defaultTemplate.trim()) {
    // Saving back to exactly the default is equivalent to a reset - drop the
    // override row instead of keeping a redundant copy of the default text.
    await prisma.promptTemplate.deleteMany({ where: { key } });
    return;
  }

  await prisma.promptTemplate.upsert({
    where: { key },
    update: { template: trimmed },
    create: { key, template: trimmed },
  });
}

export async function resetPromptTemplate(key: string): Promise<void> {
  await prisma.promptTemplate.deleteMany({ where: { key } });
}

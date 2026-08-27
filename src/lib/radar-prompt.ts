import { renderPrompt } from '@/lib/prompts';

export type RadarScoringItem = { key: string; title: string; category: string };

export async function buildRadarScoringPrompt(items: RadarScoringItem[]): Promise<string> {
  return renderPrompt('radar-scoring', {
    ITEMS_JSON: JSON.stringify(items.map((item) => ({ key: item.key, title: item.title, category: item.category }))),
  });
}

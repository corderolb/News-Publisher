import { prisma } from '@/lib/prisma';

export type SnapshotRow = {
  id: string;
  preset: string;
  focusThemes: string;
  primaryDomain: string;
  payload: string;
  generatedAt: Date;
  usedAI: boolean;
  aiDurationMs: number | null;
  aiIncluded: number;
  aiRejected: number;
  aiError: string | null;
  fallbackReason: string | null;
  inputTopics: number;
};

export type SnapshotDelegate = {
  findFirst: (args: unknown) => Promise<SnapshotRow | null>;
  findMany: (args: unknown) => Promise<SnapshotRow[]>;
  create: (args: unknown) => Promise<SnapshotRow>;
  count: (args: unknown) => Promise<number>;
};

let snapshotModelWarningShown = false;

export function getSnapshotDelegate(): SnapshotDelegate | null {
  const delegate = (prisma as unknown as Record<string, Partial<SnapshotDelegate>>).researchTopicSnapshot;
  if (
    delegate &&
    typeof delegate.findFirst === 'function' &&
    typeof delegate.findMany === 'function' &&
    typeof delegate.create === 'function' &&
    typeof delegate.count === 'function'
  ) {
    return delegate as SnapshotDelegate;
  }

  if (!snapshotModelWarningShown) {
    snapshotModelWarningShown = true;
    console.warn(
      '[research-topics] Prisma delegate researchTopicSnapshot nicht verfuegbar. Bitte `npx prisma generate` ausfuehren und den dev-Server neu starten.'
    );
  }

  return null;
}

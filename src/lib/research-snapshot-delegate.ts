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
  findFirst: (args: any) => Promise<SnapshotRow | null>;
  findMany: (args: any) => Promise<SnapshotRow[]>;
  create: (args: any) => Promise<SnapshotRow>;
  count: (args: any) => Promise<number>;
};

let snapshotModelWarningShown = false;

export function getSnapshotDelegate(): SnapshotDelegate | null {
  const delegate = (prisma as any).researchTopicSnapshot;
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

"use client";

import { useTransition } from "react";
import { RepeatIcon } from "@/app/admin/JobIcons";

export default function RefreshFilmRadarButton({ refreshAction }: { refreshAction: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => refreshAction())}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-alt)] disabled:opacity-60"
    >
      <RepeatIcon className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Aktualisiert..." : "Jetzt aktualisieren"}
    </button>
  );
}

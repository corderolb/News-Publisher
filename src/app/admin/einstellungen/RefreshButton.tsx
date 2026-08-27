"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RepeatIcon } from "@/app/admin/JobIcons";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    startTransition(() => {
      router.refresh();
    });
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-alt)] disabled:opacity-60"
    >
      <RepeatIcon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
      Verbindung pruefen
    </button>
  );
}

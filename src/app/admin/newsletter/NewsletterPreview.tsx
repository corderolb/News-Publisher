"use client";

import { useState } from "react";
import { DesktopIcon, MobileIcon } from "@/app/admin/JobIcons";

type PreviewMode = "desktop" | "mobile";

export default function NewsletterPreview({ html, articleCount }: { html: string; articleCount: number }) {
  const [mode, setMode] = useState<PreviewMode>("desktop");

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--primary-strong)]">Live-Vorschau</h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Schnelle Naeherung (Score-Sortierung) — beim tatsaechlichen Versand waehlt und ordnet die KI final aus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-[var(--muted)]">{articleCount} Artikel im aktuellen Zeitraum</span>
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-1">
            <button
              type="button"
              onClick={() => setMode("desktop")}
              aria-pressed={mode === "desktop"}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                mode === "desktop" ? "bg-white text-[var(--primary-strong)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <DesktopIcon className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setMode("mobile")}
              aria-pressed={mode === "mobile"}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                mode === "mobile" ? "bg-white text-[var(--primary-strong)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <MobileIcon className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>
        </div>
      </div>

      {mode === "desktop" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          <iframe
            title="Newsletter-Vorschau (Desktop)"
            srcDoc={html}
            sandbox=""
            className="h-[560px] w-full min-w-[664px] bg-[var(--surface-alt)]"
          />
        </div>
      ) : (
        <div className="mt-4 flex justify-center overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] py-6">
          <div className="w-[375px] shrink-0 overflow-hidden rounded-[2.25rem] border-[8px] border-slate-900 bg-slate-900 shadow-xl">
            <div className="flex h-6 items-center justify-center bg-slate-900">
              <div className="h-1 w-16 rounded-full bg-slate-700" />
            </div>
            <iframe
              title="Newsletter-Vorschau (Mobile)"
              srcDoc={html}
              sandbox=""
              className="h-[600px] w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

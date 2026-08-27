"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Filmradar",
    items: [{ href: "/admin/filmradar", label: "FILMRADAR" }],
  },
  {
    title: "Workspace",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/radar", label: "Radar" },
      { href: "/admin/authors", label: "Autoren" },
      { href: "/admin/sources", label: "Quellen" },
      { href: "/admin/articles", label: "Artikel" },
    ],
  },
  {
    title: "Marketing",
    items: [{ href: "/admin/newsletter", label: "Newsletter" }],
  },
  {
    title: "Konfiguration",
    items: [
      { href: "/admin/einstellungen", label: "Einstellungen" },
      { href: "/admin/prompts", label: "Prompts" },
      { href: "/admin/prozesse", label: "Prozesse" },
    ],
  },
  {
    title: "Monitor",
    items: [{ href: "/pipeline", label: "Pipeline" }],
  },
];

export default function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // "/admin" must match exactly - otherwise it (and every other route that's
  // a prefix of a sibling, e.g. "/admin/radar" vs "/admin/radar/x") would stay
  // highlighted while a more specific nav item below it is also active.
  function isActive(href: string) {
    if (href === "/" || href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      <div className="border-b border-[var(--border)] px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--sidebar-muted)]">Spielfilm.de</p>
        <h1 className="mt-2 text-[15px] font-extrabold text-[var(--primary-strong)]">AI Research Tool</h1>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="px-3 py-4">
          <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">{section.title}</p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                    (active
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--sidebar-text)] hover:bg-[var(--surface-alt)]")
                  }
                  aria-current={active ? "page" : undefined}
                >
                  <span>{item.label}</span>
                  {active ? <span className="text-xs">●</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-auto border-t border-[var(--border)] px-5 py-4 text-xs text-[var(--sidebar-muted)]">
        Job Scheduling, Quellen-Monitoring und KI-Redaktion in einer Ansicht.
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-[var(--border)] bg-[var(--sidebar-bg)] lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--sidebar-text)]"
          >
            Menue
          </button>
          <span className="text-sm font-extrabold text-[var(--primary-strong)]">AI Research Tool</span>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/35" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-extrabold text-[var(--primary-strong)]">Navigation</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--sidebar-text)]"
              >
                Schliessen
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

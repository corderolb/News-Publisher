"use client";

import { usePathname } from "next/navigation";

type RouteInfo = { section: string; title: string };

// Longest-prefix match against the pathname, so nested/dynamic routes
// (e.g. /article/[slug]) still resolve to a sensible parent entry.
const ROUTES: Array<{ href: string; info: RouteInfo }> = [
  { href: "/admin/filmradar", info: { section: "Filmradar", title: "FILMRADAR" } },
  { href: "/admin/newsletter", info: { section: "Marketing", title: "Newsletter-Digest" } },
  { href: "/admin/einstellungen", info: { section: "Konfiguration", title: "Einstellungen" } },
  { href: "/admin/prozesse", info: { section: "Konfiguration", title: "Prozesse" } },
  { href: "/admin/prompts", info: { section: "Konfiguration", title: "Prompts" } },
  { href: "/admin/radar", info: { section: "Workspace", title: "Radar" } },
  { href: "/admin/authors", info: { section: "Workspace", title: "Autoren" } },
  { href: "/admin/sources", info: { section: "Workspace", title: "Quellen" } },
  { href: "/admin/articles", info: { section: "Workspace", title: "Artikel" } },
  { href: "/admin", info: { section: "Workspace", title: "Operations Overview" } },
  { href: "/pipeline", info: { section: "Monitor", title: "Pipeline Monitor" } },
  { href: "/article", info: { section: "Artikel", title: "Artikel-Ansicht" } },
  { href: "/", info: { section: "Dashboard", title: "Content Performance Overview" } },
];

function resolveRoute(pathname: string): RouteInfo {
  const match = ROUTES.find((route) => (route.href === "/" ? pathname === "/" : pathname.startsWith(route.href)));
  return match?.info || { section: "", title: "Spielfilm.de AI Research Tool" };
}

// Fixed alongside the sidebar (desktop only - the existing mobile top bar
// already anchors the top on small screens, a second stacked bar there
// would eat too much vertical space) so page identity stays visible while
// scrolling, exactly like the nav itself.
export default function TopBar() {
  const pathname = usePathname();
  const { section, title } = resolveRoute(pathname);

  return (
    <div className="fixed inset-x-0 top-0 z-30 hidden h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:left-72 lg:flex lg:items-center">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-2 px-4 sm:px-6 lg:px-10">
        {section && (
          <>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{section}</span>
            <span className="text-[var(--border)]">/</span>
          </>
        )}
        <span className="text-sm font-bold text-[var(--primary-strong)]">{title}</span>
      </div>
    </div>
  );
}

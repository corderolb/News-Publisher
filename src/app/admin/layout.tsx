// Admin dashboard pages show live operational data (queue backlog, job
// status, counts) queried straight from Prisma - never worth statically
// caching, and static prerendering would require DB access at build time
// (which fails in a clean build environment, e.g. Docker/CI, before any
// migration has run). Forcing the whole /admin/* subtree dynamic avoids both.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

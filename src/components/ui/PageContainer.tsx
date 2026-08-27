import type { ReactNode } from "react";

// Standardizes the outer page wrapper (previously 1320px/1200px/1100px
// depending on the page, for no functional reason) on one max-width.
export default function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10 ${className}`.trim()}>{children}</div>;
}

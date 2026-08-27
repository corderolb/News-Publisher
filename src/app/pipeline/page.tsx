import Link from 'next/link';
import JobStatusPanel from '../admin/JobStatusPanel';

export const metadata = {
  title: 'Pipeline Monitor',
};

export default function PipelinePage() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">Warteschlange, laufende Jobs, Details.</p>
        <Link href="/" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Zum Dashboard
        </Link>
      </div>

      <JobStatusPanel />
    </div>
  );
}

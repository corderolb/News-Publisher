// Shared absolute date+time formatting - was reimplemented identically
// (new Date(value).toLocaleString()) in 4 separate files under 3 different
// names (formatDate, formatDateTime).
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

// Shared relative-time formatting for both past (Hot Topics "vor 3 Std.")
// and future (Job-Zeitplan "in 3 Std.") timestamps.
export function formatRelativeTime(value?: string | Date | null): string {
  if (!value) return "-";
  const target = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(target)) return "-";

  const diffMs = target - Date.now();
  const abs = Math.abs(diffMs);
  const future = diffMs > 0;
  const minutes = Math.round(abs / 60000);

  if (minutes < 1) return future ? "gleich" : "gerade eben";
  if (minutes < 60) return future ? `in ${minutes} Min.` : `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `in ${hours} Std.` : `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days < 7) return future ? `in ${days} Tg.` : `vor ${days} Tg.`;
  return new Date(target).toLocaleDateString();
}

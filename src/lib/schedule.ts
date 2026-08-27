export type RunTime = { hour: number; minute: number };

const FALLBACK_TIMES: RunTime[] = [
  { hour: 8, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 20, minute: 0 },
];

// Accepts entries in either "H" (legacy, e.g. "6") or "HH:MM" (e.g. "06:00")
// format, comma-separated. Always returns times sorted ascending by time of day.
export function parseRunTimes(value?: string | null): RunTime[] {
  if (!value) return FALLBACK_TIMES;

  const times = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): RunTime => {
      const [hourPart, minutePart] = entry.split(':');
      return {
        hour: Number(hourPart),
        minute: minutePart !== undefined ? Number(minutePart) : 0,
      };
    })
    .filter(
      (t) =>
        Number.isFinite(t.hour) && t.hour >= 0 && t.hour <= 23 &&
        Number.isFinite(t.minute) && t.minute >= 0 && t.minute <= 59
    )
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  return times.length > 0 ? times : FALLBACK_TIMES;
}

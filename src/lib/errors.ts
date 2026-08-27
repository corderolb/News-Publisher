// Shared "safe error message" extraction for API route catch blocks - avoids
// `catch (error: any)` (an eslint no-explicit-any violation) while still
// reading `.message` off whatever was thrown, even if it isn't an Error.
export function getErrorMessage(error: unknown, fallback = "Unbekannter Fehler"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

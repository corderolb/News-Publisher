import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Single source of truth for the form-control look used across every
// overlay/form in the app (previously copy-pasted verbatim in 12+ files).
export const fieldInputClassName =
  "block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)] transition focus:ring-2";

type LabelVariant = "default" | "filter";

const LABEL_CLASS: Record<LabelVariant, string> = {
  default: "mb-1 flex items-center text-sm font-semibold text-[var(--foreground)]",
  filter: "mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]",
};

export function Label({
  variant = "default",
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { variant?: LabelVariant }) {
  return <label className={`${LABEL_CLASS[variant]} ${className}`.trim()} {...props} />;
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldInputClassName} ${className}`.trim()} {...props} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldInputClassName} ${className}`.trim()} {...props} />;
}

export function TextareaInput({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldInputClassName} ${className}`.trim()} {...props} />;
}

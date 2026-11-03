"use client";

import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/lib/format";

export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-8 text-sm text-ink-soft outline-none hover:border-ink/30 hover:bg-canvas focus:border-brand focus:ring-4 focus:ring-brand/10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-faint outline-none focus:ring-4";
const inputOk = "border-line-strong hover:border-ink/30 focus:border-brand focus:ring-brand/10";
const inputError = "border-danger focus:border-danger focus:ring-danger/10";
const inputClass = cx(inputBase, inputOk);

export function TextField({
  id,
  label,
  required,
  value,
  onChange,
  error,
  ...input
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Shown under the field in red; also marks the input invalid */
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink">
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={cx(inputBase, error ? inputError : inputOk, "h-10")}
        {...input}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/** Red message that slides in under a field. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden pt-1 text-xs text-danger"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass, "min-h-24 resize-y py-2.5")}
        {...rest}
      />
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-sm text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line-strong accent-brand transition-transform group-hover:scale-110"
      />
      <span className="transition-colors group-hover:text-ink">{label}</span>
    </label>
  );
}

/** Toggleable pill used for skill filters. */
export function Chip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cx(
        "rounded-full border px-2.5 py-1 text-xs hover:-translate-y-px active:scale-95",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-line-strong bg-surface text-ink-soft hover:border-ink/30 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

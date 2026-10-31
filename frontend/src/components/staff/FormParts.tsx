"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip, Select } from "@/components/ui/Fields";
import { cx } from "@/lib/format";

/** A titled card that groups related form fields. */
export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <CardTitle>{title}</CardTitle>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function LabeledSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  format = (v) => v,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  format?: (value: string) => string;
}) {
  const normalised = options.map((o) => (typeof o === "string" ? { value: o, label: format(o) } : o));
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">
        {label}
        {required && " *"}
      </p>
      <Select
        label={label}
        value={value}
        onChange={onChange}
        options={placeholder ? [{ value: "", label: placeholder }, ...normalised] : normalised}
      />
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium">{children}</p>;
}

/** Toggleable chips plus an optional "+ Add" chip that turns into a small input. */
export function ChipPicker({
  items,
  selected,
  onToggle,
  addLabel,
  onAdd,
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  addLabel?: string;
  onAdd?: (item: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const value = draft.trim();
    if (value && onAdd) onAdd(value);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.span key={item} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <Chip label={item} active={selected.includes(item)} onToggle={() => onToggle(item)} />
          </motion.span>
        ))}
      </AnimatePresence>
      {addLabel && onAdd && (
        <motion.span layout>
          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              placeholder="Type and press Enter"
              aria-label={addLabel}
              className="h-7 w-44 rounded-full border border-brand bg-surface px-3 text-xs outline-none ring-4 ring-brand/10"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-ink-soft hover:-translate-y-px hover:border-brand hover:text-brand active:scale-95"
            >
              + {addLabel}
            </button>
          )}
        </motion.span>
      )}
    </div>
  );
}

/** Blue chips with an × to remove them (e.g. service areas). */
export function RemovableChips({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.span
            key={item}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
            className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-soft py-1 pl-2.5 pr-1.5 text-xs text-brand"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(item)}
              className="flex size-4 items-center justify-center rounded-full hover:bg-brand hover:text-white"
            >
              ×
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Upload box that only keeps the file name for now — uploading needs the backend. */
export function FileField({
  label,
  placeholder,
  fileName,
  onChange,
  accept = "image/png,image/jpeg",
}: {
  label: string;
  placeholder: string;
  fileName: string;
  onChange: (name: string) => void;
  accept?: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
      />
      <span className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm hover:border-ink/30 hover:bg-canvas">
        <span className={cx("truncate", fileName ? "text-ink" : "text-faint")}>{fileName || placeholder}</span>
        <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-muted" aria-hidden>
          <path d="M8 11V3M5 6l3-3 3 3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

export function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

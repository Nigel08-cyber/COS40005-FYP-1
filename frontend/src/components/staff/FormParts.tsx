"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip, Select } from "@/components/ui/Fields";
import { cx } from "@/lib/format";

/** A titled card that groups related form fields. */
export function FormSection({
  title,
  hint,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  /** Rendered after the title, e.g. a "Not saved yet" tag for a whole section */
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <CardTitle>
        {title}
        {badge}
      </CardTitle>
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
  labelExtra,
  format = (v) => v,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** Rendered after the label, e.g. a "Not saved yet" tag */
  labelExtra?: React.ReactNode;
  format?: (value: string) => string;
}) {
  const normalised = options.map((o) => (typeof o === "string" ? { value: o, label: format(o) } : o));
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">
        {label}
        {required && " *"}
        {labelExtra}
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

/** max-h-64 list plus its gap */
const LIST_HEIGHT_PX = 264;
const BUTTON_HEIGHT_PX = 40;

/**
 * Compact time dropdown: the open list shows 8 times and scrolls to the rest.
 * Keyboard: arrows, Home / End, Enter or Space to choose, Escape to close.
 */
export function TimeSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [openUp, setOpenUp] = useState(false);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));

  const show = () => {
    // Open upward when the 8-row list would not fit below the field.
    const box = root.current?.getBoundingClientRect();
    setOpenUp(!!box && window.innerHeight - box.bottom < LIST_HEIGHT_PX && box.bottom - BUTTON_HEIGHT_PX > LIST_HEIGHT_PX);
    setActive(selected);
    setOpen(true);
  };
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Keep the highlighted time visible, centred when the list opens.
  useEffect(() => {
    const box = list.current;
    const row = box?.children[active] as HTMLElement | undefined;
    if (!open || !box || !row) return;
    if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop - (box.clientHeight - row.offsetHeight) / 2;
    }
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, options.length - 1),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: options.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-line-strong bg-surface pl-3 pr-3 text-sm text-ink-soft outline-none hover:border-ink/30 hover:bg-canvas focus:border-brand focus:ring-4 focus:ring-brand/10"
      >
        {options[selected]?.label ?? value}
        <svg
          className={cx("size-3.5 text-muted transition-transform duration-200", open && "rotate-180")}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className={cx(
            "absolute z-30 max-h-64 w-full overflow-y-auto rounded-lg border border-line-strong bg-surface py-0 shadow-lg shadow-ink/10",
            openUp ? "bottom-11" : "mt-1",
          )}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === selected}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={cx(
                "flex h-8 cursor-pointer items-center px-3 text-sm",
                i === selected ? "bg-brand text-white" : i === active ? "bg-brand-soft text-brand" : "text-ink-soft",
              )}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium">{children}</p>;
}

/** Toggleable chips plus an optional "+ Add" chip that turns into a small input. Items in `removable` get an ×. */
export function ChipPicker({
  items,
  selected,
  onToggle,
  addLabel,
  onAdd,
  removable = [],
  onRemove,
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  addLabel?: string;
  onAdd?: (item: string) => void;
  /** Items the user added themselves; the default options are never listed here */
  removable?: string[];
  onRemove?: (item: string) => void;
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
        {items.map((item) => {
          const canRemove = !!onRemove && removable.includes(item);
          return (
            <motion.span
              key={item}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              className="relative inline-flex"
            >
              <Chip
                label={item}
                active={selected.includes(item)}
                onToggle={() => onToggle(item)}
                className={canRemove ? "pr-6" : undefined}
              />
              {canRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  title={`Remove ${item}`}
                  onClick={() => onRemove(item)}
                  className="absolute right-1 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-current hover:bg-danger hover:text-white focus-visible:bg-danger focus-visible:text-white focus-visible:outline-none"
                >
                  ×
                </button>
              )}
            </motion.span>
          );
        })}
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
  labelExtra,
  accept = "image/png,image/jpeg",
}: {
  label: string;
  placeholder: string;
  fileName: string;
  onChange: (name: string) => void;
  /** Rendered after the label, e.g. a "Not saved yet" tag */
  labelExtra?: React.ReactNode;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  const remove = () => {
    // Clear the browser's selection too, so the same file can be chosen again.
    if (input.current) input.current.value = "";
    onChange("");
  };

  return (
    <div className="relative">
      <label className="block">
        <FieldLabel>
          {label}
          {labelExtra}
        </FieldLabel>
        <input
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file.name);
          }}
        />
        <span
          className={cx(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface pl-3 text-sm hover:border-ink/30 hover:bg-canvas",
            fileName ? "pr-10" : "pr-3",
          )}
        >
          <span className={cx("truncate", fileName ? "text-ink" : "text-faint")}>{fileName || placeholder}</span>
          {!fileName && (
            <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-muted" aria-hidden>
              <path d="M8 11V3M5 6l3-3 3 3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </label>
      {fileName && (
        <button
          type="button"
          aria-label={`Remove ${fileName}`}
          title="Remove file"
          onClick={remove}
          className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full text-muted hover:bg-danger hover:text-white focus-visible:bg-danger focus-visible:text-white focus-visible:outline-none"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

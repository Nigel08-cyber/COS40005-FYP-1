"use client";

import { motion } from "motion/react";
import { cx } from "@/lib/format";
import { SLIDE_SPRING } from "./MotionProvider";

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

/**
 * Underline tabs. The blue underline slides between tabs instead of jumping.
 * `id` must be unique per tab group on the page (it names the shared layout animation).
 */
export function Tabs<T extends string>({
  id,
  items,
  value,
  onChange,
  className,
  stretch = false,
}: {
  id: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  stretch?: boolean;
}) {
  return (
    <div role="tablist" className={cx("flex border-b border-line", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cx(
              "relative px-3 pb-2.5 pt-1 text-sm",
              stretch && "flex-1",
              active ? "font-medium text-brand" : "text-muted hover:text-ink",
            )}
          >
            {item.label}
            {active && (
              <motion.span
                layoutId={`tab-underline-${id}`}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand"
                transition={SLIDE_SPRING}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

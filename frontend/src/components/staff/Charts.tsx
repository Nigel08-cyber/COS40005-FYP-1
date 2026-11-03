"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cx } from "@/lib/format";
import type { ChartPoint, SkillShare } from "@/lib/staffTypes";

/**
 * Single-series vertical bar chart. One bar is emphasised (e.g. the latest week or the peak day);
 * hovering or focusing a bar shows its value.
 */
export function VerticalBars({
  data,
  highlight,
  unit,
  label,
  height = "h-32",
}: {
  data: ChartPoint[];
  highlight: number;
  unit: string;
  label: string;
  height?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div>
      <div className={cx("flex items-end gap-1.5", height)} role="list" aria-label={label}>
        {data.map((d, i) => {
          const active = hovered === i;
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              role="listitem"
              aria-label={`${d.label}: ${d.value} ${unit}`}
              tabIndex={0}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              className="relative flex h-full flex-1 items-end rounded-t outline-none"
            >
              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow-lg"
                    style={{ bottom: `calc(${pct}% + 6px)` }}
                  >
                    {d.value} {unit}
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                className={cx(
                  "w-full rounded-t transition-colors duration-200",
                  i === highlight ? "bg-brand" : active ? "bg-brand/70" : "bg-brand-bar",
                )}
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[11px] text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bars, e.g. "share of projects requesting each skill". */
export function ShareBars({ data }: { data: SkillShare[] }) {
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.skill} className="grid grid-cols-[96px_1fr_36px] items-center gap-3 text-xs">
          <span className="truncate text-ink-soft">{d.skill}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-line">
            <motion.span
              className="block h-full rounded-full bg-brand"
              initial={{ width: 0 }}
              animate={{ width: `${d.percent}%` }}
              transition={{ duration: 0.7, delay: i * 0.06 }}
            />
          </span>
          <span className="text-right text-muted">{d.percent}%</span>
        </li>
      ))}
    </ul>
  );
}

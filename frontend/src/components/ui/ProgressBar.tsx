"use client";

import { motion } from "motion/react";
import { cx } from "@/lib/format";

/** Spots-filled bar. Animates smoothly when the value changes (e.g. after registering). */
export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const full = value >= max;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <motion.div
        className={cx("h-full rounded-full", full ? "bg-success" : "bg-brand")}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7 }}
      />
    </div>
  );
}

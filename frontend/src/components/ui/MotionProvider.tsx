"use client";

import { MotionConfig } from "motion/react";

/** Shared easing for every motion animation; matches --ease-smooth in globals.css. */
export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;

/** Spring used by sliding indicators (tabs, role switch, nav underline). */
export const SLIDE_SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: EASE_SMOOTH }}>
      {children}
    </MotionConfig>
  );
}

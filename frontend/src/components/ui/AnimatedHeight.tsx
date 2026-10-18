"use client";

import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

/** Smoothly animates its height whenever its content grows or shrinks. */
export function AnimatedHeight({ children, className }: { children: React.ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0].blockSize));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={className}
      style={{ overflow: "hidden" }}
      initial={false}
      animate={{ height }}
      transition={{ duration: 0.35 }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

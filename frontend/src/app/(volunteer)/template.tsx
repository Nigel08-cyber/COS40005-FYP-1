"use client";

import { motion } from "motion/react";
import { useEffect } from "react";

// The first page load shows content immediately (no waiting for JavaScript);
// only later in-app navigations play the enter animation.
let hasMounted = false;

/** Page enter transition: volunteer pages fade and rise in on navigation. */
export default function VolunteerTemplate({ children }: { children: React.ReactNode }) {
  const animate = hasMounted;
  useEffect(() => {
    hasMounted = true;
  }, []);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

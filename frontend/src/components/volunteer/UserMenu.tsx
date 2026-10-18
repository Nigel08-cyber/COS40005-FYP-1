"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logOut } from "@/lib/api/auth";
import { cx } from "@/lib/format";
import { useVolunteer } from "./VolunteerProvider";

/** Name + avatar in the nav bar. Opens a small menu with Profile and Log out. */
export function UserMenu() {
  const { volunteer } = useVolunteer();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const handleLogOut = async () => {
    setLeaving(true);
    await logOut();
    // Full page load (not a client-side push): clears all in-memory state, and
    // "replace" stops the Back button from returning to the signed-in pages.
    window.location.replace("/login");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx("group flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-canvas", open && "bg-canvas")}
      >
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-xs font-medium text-ink">{volunteer.fullName}</span>
          <span className="block text-[11px] text-muted">{volunteer.roleLabel}</span>
        </span>
        <span className="flex size-8 items-center justify-center rounded-full border border-line bg-canvas text-[11px] font-medium text-ink-soft transition-colors group-hover:border-brand-line group-hover:bg-brand-soft group-hover:text-brand">
          {volunteer.initials}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10"
          >
            <div className="px-2.5 py-2">
              <p className="text-sm font-medium">{volunteer.fullName}</p>
              <p className="truncate text-xs text-muted">{volunteer.email}</p>
            </div>
            <div className="my-1 h-px bg-line" />
            <Link
              role="menuitem"
              href="/profile"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-2 text-sm text-ink-soft hover:bg-canvas hover:text-ink"
            >
              My profile
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={handleLogOut}
              disabled={leaving}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-soft disabled:opacity-60"
            >
              {leaving ? "Logging out…" : "Log out"}
              <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
                <path
                  d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h2M10.5 11L13.5 8l-3-3M13.5 8H6.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

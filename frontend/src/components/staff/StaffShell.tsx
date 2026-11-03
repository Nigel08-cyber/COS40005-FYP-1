"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { SLIDE_SPRING } from "@/components/ui/MotionProvider";
import { type AccountRole, logOut } from "@/lib/api/auth";
import { cx } from "@/lib/format";
import type { StaffUser } from "@/lib/staffTypes";
import { initialsOf, ROLE_LABELS, useSessionGuard } from "@/lib/useSessionGuard";

/** A nav entry. Without `href` it is shown greyed out as "coming soon" (no wireframe yet). */
export interface StaffLink {
  label: string;
  href?: string;
  /** Path prefix that marks the link active; defaults to href */
  match?: string;
}

interface StaffContextValue {
  user: StaffUser;
  notify: (message: string) => void;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used inside <StaffShell>");
  return ctx;
}

function isActive(pathname: string, link: StaffLink) {
  const prefix = link.match ?? link.href;
  return !!prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Page frame for NGO Administrator and Project Coordinator screens:
 * top nav, left sidebar, user menu with Log out, toasts and the (FAKE) login check.
 */
export function StaffShell({
  user: fakeUser,
  allowedRoles,
  homeHref,
  topLinks,
  sideTitle,
  sideLinks,
  children,
}: {
  user: StaffUser;
  /** Roles that may open these pages; anyone else is sent to their own home page. */
  allowedRoles: AccountRole[];
  homeHref: string;
  topLinks: StaffLink[];
  sideTitle: string;
  sideLinks: StaffLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const nextId = useRef(0);

  // Real login + role check against the backend
  const sessionUser = useSessionGuard(allowedRoles);
  // Name, email and role come from the real account; the organisation is still FAKE data
  const user: StaffUser = sessionUser
    ? {
        ...fakeUser,
        fullName: sessionUser.fullName,
        initials: initialsOf(sessionUser.fullName),
        email: sessionUser.email,
        roleLabel: ROLE_LABELS[sessionUser.role],
      }
    : { ...fakeUser, fullName: "", initials: "", email: "", roleLabel: "" };

  const notify = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <StaffContext.Provider value={{ user, notify }}>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Logo href={homeHref} />
          <nav className="mx-auto flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
            {topLinks.map((link) => (
              <NavItem key={link.label} link={link} active={isActive(pathname, link)} layoutId="staff-top-active" />
            ))}
          </nav>
          <StaffUserMenu user={user} />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-line bg-surface px-3 py-5 lg:block">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{sideTitle}</p>
          <ul className="mt-2 space-y-0.5">
            {sideLinks.map((link) => (
              <li key={link.label}>
                <SideItem link={link} active={isActive(pathname, link)} />
              </li>
            ))}
          </ul>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-xl shadow-ink/20"
            >
              <span className="size-2 rounded-full bg-success" aria-hidden />
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </StaffContext.Provider>
  );
}

function NavItem({ link, active, layoutId }: { link: StaffLink; active: boolean; layoutId: string }) {
  if (!link.href) {
    return (
      <span
        title="Coming in a later sprint"
        className="cursor-not-allowed whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-faint"
      >
        {link.label}
      </span>
    );
  }
  return (
    <Link
      href={link.href}
      className={cx(
        "relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
        active ? "font-medium text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink",
      )}
    >
      {active && (
        <motion.span layoutId={layoutId} className="absolute inset-0 -z-10 rounded-md bg-brand-soft" transition={SLIDE_SPRING} />
      )}
      {link.label}
    </Link>
  );
}

function SideItem({ link, active }: { link: StaffLink; active: boolean }) {
  const square = (
    <span
      className={cx(
        "size-3.5 shrink-0 rounded-[4px] transition-colors duration-200",
        active ? "bg-brand" : "bg-line-strong/70 group-hover:bg-ink-soft/40",
      )}
      aria-hidden
    />
  );

  if (!link.href) {
    return (
      <span
        title="Coming in a later sprint"
        className="flex cursor-not-allowed items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-faint"
      >
        {square}
        {link.label}
        <span className="ml-auto text-[10px]">Soon</span>
      </span>
    );
  }

  return (
    <Link
      href={link.href}
      className={cx(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
        active ? "font-medium text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink",
      )}
    >
      {active && (
        <motion.span
          layoutId="staff-side-active"
          className="absolute inset-0 -z-10 rounded-lg bg-brand-soft"
          transition={SLIDE_SPRING}
        />
      )}
      {square}
      {link.label}
    </Link>
  );
}

function StaffUserMenu({ user }: { user: StaffUser }) {
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
    // Full page load clears all in-memory state; "replace" keeps Back from returning here
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
          <span className="block text-xs font-medium text-ink">{user.fullName}</span>
          <span className="block text-[11px] text-muted">{user.roleLabel}</span>
        </span>
        <span className="flex size-8 items-center justify-center rounded-full border border-line bg-canvas text-[10px] font-medium text-ink-soft transition-colors group-hover:border-brand-line group-hover:bg-brand-soft group-hover:text-brand">
          {user.initials}
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
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10"
          >
            <div className="px-2.5 py-2">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{user.organisation}</p>
            </div>
            <div className="my-1 h-px bg-line" />
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

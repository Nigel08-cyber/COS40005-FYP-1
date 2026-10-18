"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { SLIDE_SPRING } from "@/components/ui/MotionProvider";
import { cx } from "@/lib/format";
import { UserMenu } from "./UserMenu";

const links = [
  { href: "/opportunities", label: "Browse opportunities" },
  { href: "/activities", label: "My activities" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo href="/dashboard" />

        <nav className="mx-auto flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  active ? "font-medium text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-md bg-brand-soft"
                    transition={SLIDE_SPRING}
                  />
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}

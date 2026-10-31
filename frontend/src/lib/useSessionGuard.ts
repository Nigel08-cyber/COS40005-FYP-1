"use client";

import { useEffect, useState } from "react";
import { type AccountRole, type AuthUser, homeFor, restoreSession } from "@/lib/api/auth";

export const ROLE_LABELS: Record<AccountRole, string> = {
  volunteer: "Volunteer",
  ngo_admin: "NGO Administrator",
  project_coordinator: "Project Coordinator",
  system_admin: "System Administrator",
};

/** "Aisha Rahman" -> "AR" (at most three letters) */
export function initialsOf(fullName: string) {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Protects a group of pages. Restores the session from the backend; signed-out visitors go
 * to /login, and signed-in users without an allowed role go to their own home page.
 * Returns the signed-in user once known (null while checking).
 */
export function useSessionGuard(allowed: AccountRole[]) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const allowedKey = allowed.join(",");

  useEffect(() => {
    let cancelled = false;
    restoreSession().then((u) => {
      if (cancelled) return;
      if (!u) window.location.replace("/login");
      else if (!allowedKey.split(",").includes(u.role)) window.location.replace(homeFor(u.role));
      else setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedKey]);

  return user;
}

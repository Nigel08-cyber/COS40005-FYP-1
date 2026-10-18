"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatedHeight } from "@/components/ui/AnimatedHeight";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Fields";
import { SLIDE_SPRING } from "@/components/ui/MotionProvider";
import { Tabs } from "@/components/ui/Tabs";
import { logIn, signUp } from "@/lib/api/auth";
import { cx } from "@/lib/format";
import type { Role } from "@/lib/types";

type Mode = "login" | "signup";

const roles: { value: Role; title: string; hint: string }[] = [
  { value: "volunteer", title: "Volunteer", hint: "Find & join activities" },
  { value: "ngo_admin", title: "NGO Administrator", hint: "Manage an organisation" },
];

interface Form {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}

/**
 * Log in / Sign up card (wireframe 09a).
 * Volunteers and NGO Administrators use exactly the same fields; only the role differs.
 * Uses the FAKE auth for now (src/lib/fake/authFake.ts): anything you type logs in,
 * and no validation is done here — the backend will validate once it exists.
 */
export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [role, setRole] = useState<Role>("volunteer");
  const [form, setForm] = useState<Form>({ fullName: "", email: "", password: "", confirm: "", terms: false });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setLoading(true);
    if (mode === "signup") {
      await signUp({ role, fullName: form.fullName, email: form.email, password: form.password });
    } else {
      await logIn({ role, email: form.email, password: form.password });
    }
    setLoading(false);

    if (role === "ngo_admin") {
      setNotice("The NGO Administrator pages are coming in a later sprint.");
      return;
    }
    // New volunteers go on to create their profile; returning volunteers land on the dashboard
    router.push(mode === "signup" ? "/profile" : "/dashboard");
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <Tabs
        id="auth"
        stretch
        items={[
          { value: "login", label: "Log in" },
          { value: "signup", label: "Sign up" },
        ]}
        value={mode}
        onChange={switchMode}
      />

      <form onSubmit={submit} noValidate className="mt-6">
        <p className="mb-2 text-xs text-ink-soft">
          {mode === "signup" ? "I am signing up as" : "I am logging in as"}
        </p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
          {roles.map((r) => {
            const active = role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setRole(r.value)}
                className={cx(
                  "relative rounded-lg border px-3 py-2.5 text-left",
                  active ? "border-transparent" : "border-line hover:border-line-strong hover:bg-canvas",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="role-highlight"
                    className="absolute inset-0 rounded-lg border border-brand bg-brand-soft shadow-sm shadow-brand/10"
                    transition={SLIDE_SPRING}
                  />
                )}
                <span className="relative block">
                  <span
                    className={cx(
                      "block text-sm font-semibold transition-colors duration-300",
                      active ? "text-brand" : "text-ink",
                    )}
                  >
                    {r.title}
                  </span>
                  <span className="block text-xs text-muted">{r.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <AnimatedHeight>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "signup" ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "signup" ? -16 : 16, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25 }}
              className="space-y-4 pt-4"
            >
              {mode === "signup" && (
                <TextField
                  id="fullName"
                  label="Full name"
                  required
                  placeholder="Aisha Rahman"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(v) => update("fullName", v)}
                />
              )}
              <TextField
                id="email"
                label="Email"
                required
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                value={form.email}
                onChange={(v) => update("email", v)}
              />
              <TextField
                id="password"
                label="Password"
                required
                type="password"
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={form.password}
                onChange={(v) => update("password", v)}
              />
              {mode === "signup" && (
                <>
                  <TextField
                    id="confirm"
                    label="Confirm password"
                    required
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(v) => update("confirm", v)}
                  />
                  <div>
                    <label htmlFor="terms" className="group flex items-center gap-2.5 text-xs text-ink-soft">
                      <input
                        id="terms"
                        type="checkbox"
                        checked={form.terms}
                        onChange={(e) => update("terms", e.target.checked)}
                        className="size-4 rounded border-line-strong accent-brand"
                      />
                      <span className="group-hover:text-ink">I agree to the Terms and Privacy Policy</span>
                    </label>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {notice && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-lg border border-brand-line bg-brand-soft px-3 py-2 text-xs text-brand"
              >
                {notice}
              </motion.p>
            )}
          </AnimatePresence>
        </AnimatedHeight>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-5 w-full">
          {mode === "signup" ? "Create account" : "Log in"}
        </Button>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setNotice("Password reset will be available once accounts are connected.")}
            className="rounded text-brand hover:text-brand-hover hover:underline"
          >
            Forgot password?
          </button>
          <button
            type="button"
            onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
            className="rounded text-brand hover:text-brand-hover hover:underline"
          >
            {mode === "signup" ? "Already registered? Log in" : "New here? Sign up"}
          </button>
        </div>

        {mode === "signup" && (
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Project Coordinators and System Admins are invited by an NGO Admin / platform owner and do not
            self-register.
          </p>
        )}
      </form>
    </div>
  );
}

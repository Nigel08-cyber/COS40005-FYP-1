"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatedHeight } from "@/components/ui/AnimatedHeight";
import { Button } from "@/components/ui/Button";
import { FieldError, TextField } from "@/components/ui/Fields";
import { SLIDE_SPRING } from "@/components/ui/MotionProvider";
import { Tabs } from "@/components/ui/Tabs";
import { firstPageFor, homeFor, logIn, signUp } from "@/lib/api/auth";
import { cx } from "@/lib/format";
import type { Role } from "@/lib/types";

type Mode = "login" | "signup";

const roles: { value: Role; title: string; hint: string }[] = [
  { value: "volunteer", title: "Volunteer", hint: "Find & join activities" },
  { value: "ngo_admin", title: "NGO Administrator", hint: "Manage an organisation" },
];

// Same limits as the backend (backend/app/schemas.py → RegisterIn)
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Form {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}

type Errors = Partial<Record<keyof Form, string>>;

/** Checks the form before it is sent, so obvious mistakes don't need a round trip. */
function validate(mode: Mode, f: Form): Errors {
  const e: Errors = {};
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Please enter a valid email address.";
  if (mode === "login") {
    if (!f.password) e.password = "Please enter your password.";
    return e;
  }
  if (!f.fullName.trim()) e.fullName = "Please enter your full name.";
  if (f.password.length < PASSWORD_MIN) e.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (f.password.length > PASSWORD_MAX) e.password = `Use at most ${PASSWORD_MAX} characters.`;
  if (f.confirm !== f.password) e.confirm = "Passwords do not match.";
  if (!f.terms) e.terms = "Please accept the Terms and Privacy Policy.";
  return e;
}

/**
 * Log in / Sign up card (wireframe 09a), connected to the backend (src/lib/api/auth.ts).
 * Volunteers and NGO Administrators sign up with the same fields; only the role differs.
 * When logging in, the account's own role decides where the user lands.
 */
export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [role, setRole] = useState<Role>("volunteer");
  const [form, setForm] = useState<Form>({ fullName: "", email: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    setErrors({});
    setFormError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setFormError(null);
    const found = validate(mode, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    const result =
      mode === "signup"
        ? await signUp({ role, fullName: form.fullName, email: form.email, password: form.password })
        : await logIn({ email: form.email, password: form.password });

    if (!result.ok) {
      setLoading(false);
      setErrors(result.error.fields ?? {});
      setFormError(result.error.message ?? null);
      return;
    }
    // Keep the button spinning while the next page loads.
    // New accounts go on to create their profile; returning users land on their dashboard.
    router.push(mode === "signup" ? firstPageFor(role) : homeFor(result.user.role));
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
                  error={errors.fullName}
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
                error={errors.email}
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
                error={errors.password}
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
                    error={errors.confirm}
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
                    <FieldError message={errors.terms} />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {formError && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                {formError}
              </motion.p>
            )}
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
            onClick={() => setNotice("Password reset is not available yet. Please contact your NGO administrator.")}
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

"use client";

/*
  Password reset flow (sprint item 19, wireframes PR1–PR5):
  forgot password → check your email → set a new password → password updated, plus the expired-link page.

  TODO(backend): the backend has no password reset API and no email service yet, so nothing is sent or saved:
  - "Send reset link" / "Resend email" should call e.g. POST /auth/password-reset { email }
  - /reset-password should check the token from the email link (?token=...) and show the expired page if invalid
  - "Reset password" should call e.g. POST /auth/password-reset/confirm { token, new_password }
  Until then the buttons only move to the next screen, and a "Preview" box on the check-email screen opens
  the next steps (there is no email to click).
*/
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Fields";
import { cx } from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_S = 60;
// Same limits as sign-up (backend/app/schemas.py → RegisterIn)
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const card = "w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8";
const step = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 },
};

function BackToLogin({ className }: { className?: string }) {
  return (
    <Link href="/login" className={cx("group inline-flex items-center gap-1 rounded text-xs text-brand hover:text-brand-hover hover:underline", className)}>
      <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">
        ‹
      </span>
      Back to log in
    </Link>
  );
}

/** Round icon at the top of the result cards. */
function StatusIcon({ tone, children }: { tone: "brand" | "success" | "warning"; children: React.ReactNode }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
      className={cx("mx-auto flex size-12 items-center justify-center rounded-full text-xl font-semibold", tones[tone])}
      aria-hidden
    >
      {children}
    </motion.span>
  );
}

/* ---------------- PR1 + PR2 · /forgot-password ---------------- */

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    // TODO(backend): POST /auth/password-reset { email }
    setSentTo(email.trim());
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sentTo === null ? (
        <motion.div key="form" {...step} className={card}>
          <BackToLogin />
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">Reset your password</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Enter the email linked to your account and we will send you a link to reset your password.
          </p>
          <form onSubmit={send} noValidate className="mt-6 space-y-4">
            <TextField
              id="resetEmail"
              label="Email"
              required
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              error={error}
              onChange={(v) => {
                setEmail(v);
                setError(undefined);
              }}
            />
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Send reset link
            </Button>
          </form>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            For security, the same confirmation is shown whether or not the email is registered.
          </p>
        </motion.div>
      ) : (
        <motion.div key="sent" {...step}>
          <CheckEmail email={sentTo} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CheckEmail({ email }: { email: string }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_S);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = () => {
    // TODO(backend): POST /auth/password-reset { email } again
    setResent(true);
    setSecondsLeft(RESEND_COOLDOWN_S);
  };
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className={cx(card, "text-center")}>
      <StatusIcon tone="brand">@</StatusIcon>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">Check your email</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        If an account exists for <span className="font-medium text-ink-soft">{email}</span>, a password reset link is on
        its way.
      </p>
      <Button variant="outline" className="mt-6 w-full" disabled={secondsLeft > 0} onClick={resend}>
        Resend email
      </Button>
      <p className="mt-3 text-xs text-muted" aria-live="polite">
        {secondsLeft > 0 ? `You can request another email in ${clock}` : resent ? "Email sent again." : "You can request another email now."}
      </p>
      <p className="mt-3 text-xs text-muted">Did not receive it? Check your spam folder.</p>
      <BackToLogin className="mt-4" />

      {/* Not in the wireframe: there is no email to open until the backend sends one. */}
      <div className="mt-6 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-left text-xs text-muted">
        <span className="font-medium text-ink-soft">Preview</span> · the email service is not connected yet, so open the
        next step here:
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/reset-password" className="text-brand hover:underline">
            Open the reset link →
          </Link>
          <Link href="/reset-password/expired" className="text-brand hover:underline">
            See an expired link →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PR3 + PR4 · /reset-password ---------------- */

const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: `At least ${PASSWORD_MIN} characters`, test: (p) => p.length >= PASSWORD_MIN },
  { label: "Upper and lower case letters", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: "At least one number", test: (p) => /\d/.test(p) },
  { label: "At least one symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Needed before "Reset password" works: the length rule plus any two others ("Strong"). */
const STRONG_ENOUGH = 3;

function strengthOf(score: number) {
  if (score <= 1) return { label: "Weak", bar: "bg-danger", text: "text-danger" };
  if (score === 2) return { label: "Fair", bar: "bg-warning", text: "text-warning" };
  if (score === 3) return { label: "Strong", bar: "bg-success", text: "text-success" };
  return { label: "Very strong", bar: "bg-success", text: "text-success" };
}

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);

  const passed = RULES.map((r) => r.test(password));
  const score = passed.filter(Boolean).length;
  const strength = strengthOf(score);
  const longEnough = passed[0] && password.length <= PASSWORD_MAX;
  const matches = confirm.length > 0 && confirm === password;

  const passwordError = !tried
    ? undefined
    : !password
      ? "Please choose a new password."
      : !longEnough
        ? `Use ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`
        : score < STRONG_ENOUGH
          ? "Make it stronger: add a number, a symbol or mixed case letters."
          : undefined;
  const confirmError = tried && !matches ? "The passwords do not match." : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!longEnough || score < STRONG_ENOUGH || !matches) return;
    // TODO(backend): POST /auth/password-reset/confirm { token, new_password }
    setDone(true);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!done ? (
        <motion.div key="form" {...step} className={card}>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Set a new password</h2>
          <p className="mt-2 text-sm text-muted">Choose a strong password you have not used before.</p>
          <form onSubmit={submit} noValidate className="mt-6">
            <TextField
              id="newPassword"
              label="New password"
              required
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              value={password}
              error={passwordError}
              onChange={setPassword}
            />

            <div className="mt-3 flex gap-1.5" aria-hidden>
              {RULES.map((_, i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.span
                    className={cx("block h-full rounded-full", strength.bar)}
                    initial={false}
                    animate={{ width: password && i < score ? "100%" : "0%" }}
                    transition={{ duration: 0.25 }}
                  />
                </span>
              ))}
            </div>
            <p className={cx("mt-1.5 text-xs font-medium", password ? strength.text : "text-faint")} aria-live="polite">
              Password strength: {password ? strength.label : "—"}
            </p>

            <ul className="mt-3 space-y-2">
              {RULES.map((r, i) => (
                <li key={r.label} className={cx("flex items-center gap-2.5 text-xs transition-colors", passed[i] ? "text-ink-soft" : "text-faint")}>
                  <span
                    className={cx(
                      "size-3.5 rounded-full border transition-colors duration-200",
                      passed[i] ? "border-success bg-success" : "border-line-strong bg-surface",
                    )}
                    aria-hidden
                  />
                  {r.label}
                  <span className="sr-only">{passed[i] ? "(done)" : "(not yet)"}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <TextField
                id="confirmPassword"
                label="Confirm new password"
                required
                type="password"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX}
                value={confirm}
                error={confirmError}
                onChange={setConfirm}
              />
              {matches && !confirmError && <p className="pt-1 text-xs text-success">Passwords match</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" className="mt-6 w-full">
              Reset password
            </Button>
          </form>
        </motion.div>
      ) : (
        <motion.div key="done" {...step} className={cx(card, "text-center")}>
          <StatusIcon tone="success">✓</StatusIcon>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">Password updated</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your password has been changed. You can now log in with your new password.
          </p>
          <Button href="/login" variant="primary" size="lg" className="mt-6 w-full">
            Log in
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- PR5 · /reset-password/expired ---------------- */

export function ResetLinkExpired() {
  return (
    <div className={cx(card, "text-center")}>
      <StatusIcon tone="warning">!</StatusIcon>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">This reset link is no longer valid</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Reset links can be used once and expire after a short time. Request a new link to continue.
      </p>
      <Button href="/forgot-password" variant="primary" size="lg" className="mt-6 w-full">
        Request a new link
      </Button>
      <BackToLogin className="mt-4" />
    </div>
  );
}

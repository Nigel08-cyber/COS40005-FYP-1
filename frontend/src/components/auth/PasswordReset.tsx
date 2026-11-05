"use client";

/*
  Password reset flow (sprint item 19, wireframes PR1–PR5), connected to the backend:
  - "Send reset link" / "Resend email"  → POST /auth/password-reset { email }
    (always the same answer, whether or not the account exists; at most one email per account per minute)
  - /reset-password?token=...           → POST /auth/password-reset/check { token } (invalid → expired screen)
  - "Reset password"                    → POST /auth/password-reset/confirm { token, new_password }
  The emailed link is FRONTEND_URL/reset-password?token=... While the backend runs with EMAIL_BACKEND=log
  (no email service yet), the link is printed in the backend's terminal instead of being emailed.
*/
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Fields";
import { checkResetToken, confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth";
import { cx } from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Same as the backend's password_reset_cooldown_seconds */
const RESEND_COOLDOWN_S = 60;
// Same limits as the backend (PasswordResetConfirmIn / RegisterIn)
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

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
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
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    const result = await requestPasswordReset(email);
    setSending(false);
    if (result.ok) setSentTo(email.trim());
    else setFormError("message" in result ? result.message : "Something went wrong. Please try again.");
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
            <FormError message={formError} />
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={sending}>
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
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = async () => {
    setSending(true);
    const result = await requestPasswordReset(email);
    setSending(false);
    if (result.ok) {
      setNote("Email sent again.");
      setSecondsLeft(RESEND_COOLDOWN_S);
    } else {
      setNote("message" in result ? result.message : "Something went wrong. Please try again.");
    }
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
      <Button variant="outline" className="mt-6 w-full" disabled={secondsLeft > 0} loading={sending} onClick={resend}>
        Resend email
      </Button>
      <p className="mt-3 text-xs text-muted" aria-live="polite">
        {secondsLeft > 0 ? `You can request another email in ${clock}` : (note ?? "You can request another email now.")}
      </p>
      <p className="mt-3 text-xs text-muted">Did not receive it? Check your spam folder.</p>
      <BackToLogin className="mt-4" />
    </div>
  );
}

/* ---------------- PR3 + PR4 (+ PR5 for a bad link) · /reset-password?token=... ---------------- */

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

type LinkState = "checking" | "valid" | "invalid" | "unreachable";

/** Reads ?token= from the emailed link (wrap in <Suspense>: it uses the URL). */
export function ResetPassword() {
  const params = useSearchParams();
  // Read once: the token is removed from the address bar below and must survive that.
  const [token] = useState(() => params.get("token") ?? "");
  const [link, setLink] = useState<LinkState>(token ? "checking" : "invalid");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    // Keep the secret token out of the address bar, history and referrers.
    window.history.replaceState(null, "", "/reset-password");
    let cancelled = false;
    checkResetToken(token).then((result) => {
      if (cancelled) return;
      if (result.ok) setLink("valid");
      else if (result.expired) setLink("invalid");
      else {
        setCheckMessage(result.message);
        setLink("unreachable");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  if (link === "checking") return <ResetLinkChecking />;
  if (link === "invalid") return <ResetLinkExpired />;
  if (link === "unreachable") {
    return (
      <div className={cx(card, "text-center")}>
        <p className="text-sm text-ink-soft">{checkMessage}</p>
        <Button
          className="mt-4"
          onClick={() => {
            setLink("checking");
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  return <NewPasswordForm token={token} onExpired={() => setLink("invalid")} />;
}

export function ResetLinkChecking() {
  return (
    <div className={cx(card, "flex flex-col items-center gap-3 py-12 text-sm text-muted")} aria-busy="true">
      <span className="size-6 animate-spin rounded-full border-2 border-brand border-r-transparent" aria-hidden />
      Checking your reset link…
    </div>
  );
}

function NewPasswordForm({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFormError(null);
    if (!longEnough || score < STRONG_ENOUGH || !matches) return;
    setSaving(true);
    const result = await confirmPasswordReset(token, password);
    setSaving(false);
    if (result.ok) setDone(true);
    else if (result.expired) onExpired();
    else setFormError(result.message);
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

            <div className="mt-4">
              <FormError message={formError} />
            </div>
            <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" loading={saving}>
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

/* ---------------- PR5 · invalid / expired link (also /reset-password/expired) ---------------- */

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

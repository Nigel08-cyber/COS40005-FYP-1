import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { cx } from "@/lib/format";
import type { NgoStatus } from "@/lib/staffTypes";

/** Small grey note next to a field the backend does not store yet. */
export function NotSavedHint({ className }: { className?: string }) {
  return (
    <span
      title="The backend does not store this field yet, so changes here are not saved."
      className={cx("ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-faint", className)}
    >
      Not saved yet
    </span>
  );
}

/** Placeholder for a block that needs a backend feature that does not exist yet (e.g. AI analytics). */
export function ComingSoonCard({ title, description, className }: { title: string; description: string; className?: string }) {
  return (
    <Card className={cx("flex flex-col p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Badge>Coming soon</Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
    </Card>
  );
}

/** Shown on NGO pages before the admin has created the organisation profile. */
export function NoOrganisationCard() {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <p className="font-semibold">Create your organisation profile first</p>
      <p className="mt-1 text-sm text-muted">
        Your account is not linked to an organisation yet. Once the profile is created and approved, you can create
        projects here.
      </p>
      <Button href="/ngo/profile" variant="primary" className="mt-5">
        Create organisation profile
      </Button>
    </Card>
  );
}

/** Banner while a platform admin has not approved (or has suspended) the organisation. */
export function ApprovalBanner({ status }: { status: NgoStatus | null }) {
  if (status !== "pending" && status !== "suspended") return null;
  const pending = status === "pending";
  return (
    <div
      role="status"
      // sticks under the top nav (h-14) so it stays visible while the page scrolls
      className={cx(
        "sticky top-16 z-30 mb-6 flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-sm shadow-md",
        pending ? "border-warning/50 bg-warning-soft text-warning" : "border-danger/50 bg-danger-soft text-danger",
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 size-5 shrink-0" aria-hidden>
        <path d="M10 3l8 14H2L10 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M10 8v4M10 14.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div>
        <p className="font-semibold">{pending ? "Waiting for approval" : "Organisation suspended"}</p>
        <p>
          {pending
            ? "A platform admin has to approve your organisation before you can create projects."
            : "A platform admin suspended your organisation. Projects cannot be created or published."}
        </p>
      </div>
    </div>
  );
}

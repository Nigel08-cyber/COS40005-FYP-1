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
  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
    >
      {status === "pending"
        ? "Your organisation is waiting for approval by a platform admin. You can create projects once it is approved."
        : "Your organisation has been suspended by a platform admin. Projects cannot be created or published."}
    </div>
  );
}

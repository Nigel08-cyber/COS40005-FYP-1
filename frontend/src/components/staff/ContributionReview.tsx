"use client";

import { useState } from "react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { useStaff } from "@/components/staff/StaffShell";
import {
  type ContributionStatus,
  type StaffContribution,
  getProjectContributions,
  setContributionStatus,
} from "@/lib/api/contributions";
import { errorMessage } from "@/lib/api/http";
import { formatShortDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const STATUS: Record<ContributionStatus, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Pending" },
  verified: { tone: "success", label: "Verified" },
  rejected: { tone: "danger", label: "Rejected" },
};

/** Volunteer hours for a project (created at QR check-out). Staff can verify or reject them. */
export function ContributionReview({ projectId }: { projectId: string }) {
  const { data, error, reload } = useAsync(() => getProjectContributions(projectId));

  return (
    <Card className="p-5">
      <CardTitle>Volunteer hours</CardTitle>
      <p className="mb-4 text-xs text-muted">Added when a volunteer checks out. Rejected hours no longer count in their totals.</p>
      {error ? (
        <div className="text-center">
          <p className="text-sm text-ink-soft">{error}</p>
          <Button className="mt-3" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="h-16 animate-pulse rounded-lg bg-line" aria-busy="true" aria-label="Loading" />
      ) : (
        <Rows initial={data} />
      )}
    </Card>
  );
}

function Rows({ initial }: { initial: StaffContribution[] }) {
  const { notify } = useStaff();
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        No hours recorded yet. They appear after volunteers check out.
      </p>
    );
  }

  const counted = rows.filter((r) => r.status !== "rejected").reduce((sum, r) => sum + r.hours, 0);

  const change = async (c: StaffContribution, status: "verified" | "rejected") => {
    setBusyId(c.contribution_id);
    try {
      const updated = await setContributionStatus(c.contribution_id, status);
      setRows((list) => list.map((r) => (r.contribution_id === c.contribution_id ? { ...r, status: updated.status } : r)));
      notify(status === "verified" ? `${c.volunteer_name}'s hours verified.` : `${c.volunteer_name}'s hours rejected.`);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Volunteer</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Hours</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.contribution_id}>
                <td className="px-4 py-2.5">
                  <p>{c.volunteer_name}</p>
                  <p className="text-xs text-muted">{c.role ?? "Volunteer"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{formatShortDate(c.contribution_date)}</td>
                <td className="px-4 py-2.5 text-ink-soft">{c.hours.toFixed(2)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    {c.status !== "verified" && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyId === c.contribution_id}
                        disabled={busyId !== null}
                        onClick={() => change(c, "verified")}
                      >
                        Verify
                      </Button>
                    )}
                    {c.status !== "rejected" && (
                      <ConfirmButton
                        size="sm"
                        label="Reject"
                        question={`Reject ${c.hours.toFixed(2)} hours?`}
                        confirmLabel="Reject"
                        disabled={busyId !== null}
                        onConfirm={() => change(c, "rejected")}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-right text-xs text-muted">
        Total counted: <span className="font-medium text-ink">{Number(counted.toFixed(2))} hours</span>
      </p>
    </>
  );
}

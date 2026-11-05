"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { ComingSoonCard } from "@/components/staff/StaffNotices";
import { useStaff } from "@/components/staff/StaffShell";
import { setOrganisationStatus } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/http";
import { cx } from "@/lib/format";
import type { AdminOrganisation, AdminOrganisationsData, NgoStatus } from "@/lib/staffTypes";

const STATUS: Record<NgoStatus, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Verified" },
  pending: { tone: "warning", label: "Pending verification" },
  suspended: { tone: "danger", label: "Suspended" },
};

const formatHours = (h: number) => (Number.isInteger(h) ? h.toLocaleString("en-US") : h.toFixed(1));

/** Wireframe 16 · Admin: monitor organisations (+ audit log, which needs a backend API first). */
export function OrganisationsPage({ data }: { data: AdminOrganisationsData }) {
  const { notify } = useStaff();
  const [orgs, setOrgs] = useState(data.organisations);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verified = orgs.filter((o) => o.status === "active").length;
  const pending = orgs.filter((o) => o.status === "pending").length;
  const hours = orgs.reduce((sum, o) => sum + o.hoursThisMonth, 0);
  const open = orgs.find((o) => o.id === openId) ?? null;

  const change = async (org: AdminOrganisation, next: NgoStatus, message: string) => {
    setBusy(org.id);
    setError(null);
    try {
      const status = await setOrganisationStatus(org.id, next);
      setOrgs((list) => list.map((o) => (o.id === org.id ? { ...o, status } : o)));
      notify(message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const stats = [
    { label: "Organisations", value: orgs.length, note: `${verified} verified`, tone: "muted" },
    { label: "Pending verification", value: pending, note: pending ? "review required" : "none waiting", tone: pending ? "warning" : "muted" },
    { label: "Active projects", value: data.activeProjects, note: "across all NGOs", tone: "muted" },
    { label: "Volunteer hours (month)", value: formatHours(hours), note: "logged this month", tone: "muted" },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Organisations" subtitle="Monitor organisations and platform activity" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} interactive className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{s.value}</p>
            <p className={cx("mt-1 text-xs", s.tone === "warning" ? "text-warning" : "text-muted")}>{s.note}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <CardTitle>Registered organisations</CardTitle>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                {["Organisation", "NGO administrator", "Projects", "Volunteers", "Status", "Actions"].map((c) => (
                  <th key={c} className="px-4 py-2.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orgs.map((o) => {
                const status = STATUS[o.status];
                const isOpen = o.id === openId;
                return (
                  <tr key={o.id} className={cx("transition-colors duration-200 hover:bg-brand-soft/40", isOpen && "bg-brand-soft/60")}>
                    <td className="px-4 py-2.5 font-medium text-ink">{o.name}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{o.administrator}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{o.projects}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{o.volunteers}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setOpenId(isOpen ? null : o.id)}>
                          {isOpen ? "Close" : o.status === "pending" ? "Review" : "View"}
                        </Button>
                        {o.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="brand"
                              loading={busy === o.id}
                              onClick={() => change(o, "active", `${o.name} approved. They can now create projects.`)}
                            >
                              Approve
                            </Button>
                            <ConfirmButton
                              size="sm"
                              label="Reject"
                              question={`Reject ${o.name}?`}
                              confirmLabel="Reject"
                              onConfirm={() => change(o, "suspended", `${o.name} rejected.`)}
                            />
                          </>
                        )}
                        {o.status === "active" && (
                          <ConfirmButton
                            size="sm"
                            label="Suspend"
                            question={`Suspend ${o.name}?`}
                            confirmLabel="Suspend"
                            onConfirm={() => change(o, "suspended", `${o.name} suspended. Its projects can no longer be published.`)}
                          />
                        )}
                        {o.status === "suspended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy === o.id}
                            onClick={() => change(o, "active", `${o.name} reactivated.`)}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                    No organisations have registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key={open.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <OrganisationDetails org={open} />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <div className="mt-6">
        <ComingSoonCard
          title="Audit log"
          description="Recent security and data events (logins, suspensions, created projects, approved applications) with time, user and IP address. The database has an audit_log table, but the backend does not record events or offer an API to read them yet. Export log will come with it."
        />
      </div>
    </div>
  );
}

function OrganisationDetails({ org }: { org: AdminOrganisation }) {
  const rows: [string, string][] = [
    ["Registration no.", org.registrationNo],
    ["Areas of activity", org.focusAreas],
    ["Email", org.email],
    ["Phone", org.phone],
    ["Website", org.website],
    ["Address", [org.address, org.state].filter(Boolean).join(", ")],
    ["Volunteer hours this month", formatHours(org.hoursThisMonth)],
  ];
  return (
    <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
      <p className="font-semibold text-ink">{org.name}</p>
      <p className="mt-1 text-sm text-ink-soft">{org.description || <span className="text-faint">No description.</span>}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-line py-1.5">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-medium text-ink">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

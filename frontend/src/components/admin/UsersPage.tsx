"use client";

import { useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStaff } from "@/components/staff/StaffShell";
import { cx } from "@/lib/format";
import type { AdminUser, AdminUserRole, AdminUsersData } from "@/lib/staffTypes";
import { initialsOf } from "@/lib/useSessionGuard";

const PAGE_SIZE = 10;

const ROLE: Record<AdminUserRole, { label: string; long: string; tone: Tone }> = {
  system_admin: { label: "System Admin", long: "System Administrator", tone: "brand" },
  ngo_admin: { label: "NGO Admin", long: "NGO Administrator", tone: "brand" },
  coordinator: { label: "Coordinator", long: "Project Coordinator", tone: "neutral" },
};

const statusTone = (s: string): Tone => (s === "active" ? "success" : s === "suspended" ? "danger" : "warning");
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Downloads the rows as a CSV file (built in the browser). */
function exportCsv(users: AdminUser[]) {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["Name", "Email", "Role", "Organisation", "Status"].join(","),
    ...users.map((u) => [u.name, u.email, ROLE[u.role].long, u.organisation, u.status].map(cell).join(",")),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "volunteerhub-users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Wireframe 16 · Admin: manage users. Lists the platform's staff accounts (the system admin and every
 * organisation's admins and coordinators). Volunteers, suspending, password resets and inviting users
 * need backend APIs that do not exist yet.
 */
export function UsersPage({ data }: { data: AdminUsersData }) {
  const { notify } = useStaff();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState(data.users[0]?.key ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.users.filter(
      (u) =>
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (!role || u.role === role) &&
        (!organisation || u.organisation === organisation) &&
        (!status || u.status === status),
    );
  }, [data.users, query, role, organisation, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const selected = data.users.find((u) => u.key === selectedKey) ?? null;
  const filter = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(0);
  };
  const statuses = [...new Set(data.users.map((u) => u.status))];
  const later = (what: string) => () => notify(`${what} needs a backend API that is not available yet.`);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Users"
        subtitle="Manage platform users and roles"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
              Export CSV
            </Button>
            <Button variant="primary" onClick={later("Inviting users")}>
              + Invite user
            </Button>
          </div>
        }
      />
      <p className="mb-4 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
        Showing staff accounts (system admin, NGO admins and coordinators). Volunteers will be listed once the backend
        offers a &quot;list users&quot; API.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <input
              type="search"
              value={query}
              onChange={(e) => filter(setQuery)(e.target.value)}
              placeholder="Search by name or email..."
              aria-label="Search users"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint hover:border-ink/30 focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
            <Select
              label="Filter by role"
              value={role}
              onChange={filter(setRole)}
              options={[
                { value: "", label: "Role: All" },
                ...(Object.keys(ROLE) as AdminUserRole[]).map((r) => ({ value: r, label: ROLE[r].label })),
              ]}
            />
            <Select
              label="Filter by organisation"
              value={organisation}
              onChange={filter(setOrganisation)}
              options={[{ value: "", label: "Organisation: All" }, ...["Platform", ...data.organisations].map((o) => ({ value: o, label: o }))]}
            />
            <Select
              label="Filter by status"
              value={status}
              onChange={filter(setStatus)}
              options={[{ value: "", label: "Status: All" }, ...statuses.map((s) => ({ value: s, label: capitalise(s) }))]}
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-xs text-muted">
                <tr>
                  {["Name", "Email", "Role", "Organisation", "Status"].map((c) => (
                    <th key={c} className="px-4 py-2.5 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((u) => (
                  <tr
                    key={u.key}
                    tabIndex={0}
                    aria-selected={u.key === selectedKey}
                    onClick={() => setSelectedKey(u.key)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelectedKey(u.key))}
                    className={cx(
                      "cursor-pointer outline-none transition-colors duration-200 hover:bg-brand-soft/40 focus-visible:bg-brand-soft/60",
                      u.key === selectedKey && "bg-brand-soft/60",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">{u.name}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={ROLE[u.role].tone}>{ROLE[u.role].label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{u.organisation}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={statusTone(u.status)}>{capitalise(u.status)}</Badge>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      No users match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {filtered.length
                ? `Showing ${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + rows.length} of ${filtered.length} users`
                : "Showing 0 users"}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  ‹ Prev
                </Button>
                {Array.from({ length: pages }, (_, i) => (
                  <Button key={i} size="sm" variant={i === current ? "outline" : "ghost"} onClick={() => setPage(i)}>
                    {i + 1}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>
                  Next ›
                </Button>
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <Card className="p-5">
            <CardTitle>User details</CardTitle>
            {selected ? (
              <>
                <p className="text-xs text-muted">Selected: {selected.name}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                    {initialsOf(selected.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{selected.name}</p>
                    <p className="truncate text-xs text-muted">{selected.email}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <Detail label="Role" value={ROLE[selected.role].long} />
                  <Detail label="Organisation" value={selected.organisation} />
                  <Detail label="Last login" value="Not available yet" muted />
                  <Detail label="Status" value={capitalise(selected.status)} />
                </dl>
                <div className="mt-5 space-y-2">
                  {["Change role", "Send password reset", "Suspend user"].map((action) => (
                    <Button key={action} variant="outline" className="w-full" onClick={later(action)}>
                      {action}
                    </Button>
                  ))}
                  <p className="pt-1 text-center text-[11px] text-faint">These actions need backend APIs (coming soon).</p>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">Select a user to see their details.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx("font-medium", muted ? "text-faint" : "text-ink")}>{value}</dd>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select, TextField } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { useStaff } from "@/components/staff/StaffShell";
import { errorMessage } from "@/lib/api/http";
import { addMember, getTeam, removeMember } from "@/lib/api/projects";
import type { MemberItem, TeamData } from "@/lib/staffTypes";
import { initialsOf } from "@/lib/useSessionGuard";

const ROLE_LABEL = { ngo_admin: "NGO Administrator", coordinator: "Project Coordinator" } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** /ngo/team · the organisation's admins and project coordinators (GET/POST/DELETE /ngos/{id}/members). */
export function TeamPage({ data }: { data: TeamData }) {
  const { notify } = useStaff();
  const ngoId = data.ngoId!;
  const [members, setMembers] = useState(data.members);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"coordinator" | "ngo_admin">("coordinator");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL.test(email.trim())) {
      setEmailError("Enter the email address of their VolunteerHub account.");
      return;
    }
    setAdding(true);
    try {
      await addMember(ngoId, email, role);
      setMembers((await getTeam()).members);
      notify(`Added as ${ROLE_LABEL[role]}. They can now be chosen as a project coordinator.`);
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (m: MemberItem) => {
    setError(null);
    try {
      await removeMember(ngoId, m.userId);
      setMembers((list) => list.filter((x) => x.userId !== m.userId));
      notify(`${m.name} was removed. Projects they coordinated no longer have a coordinator.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Team" subtitle={`Administrators and project coordinators of ${data.organisation}`} />

      <Card className="p-5">
        <CardTitle>Add a team member</CardTitle>
        <p className="text-xs text-muted">
          They need a VolunteerHub account first (they can sign up as a volunteer). Coordinators run projects, review
          applications and take attendance.
        </p>
        <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-start">
          <TextField
            id="memberEmail"
            label="Email"
            type="email"
            placeholder="name@example.com"
            value={email}
            error={emailError}
            onChange={(v) => {
              setEmail(v);
              setEmailError(undefined);
            }}
          />
          <div>
            <p className="mb-1.5 text-xs font-medium">Role</p>
            <Select
              label="Role"
              value={role}
              onChange={(v) => setRole(v as typeof role)}
              options={[
                { value: "coordinator", label: ROLE_LABEL.coordinator },
                { value: "ngo_admin", label: ROLE_LABEL.ngo_admin },
              ]}
            />
          </div>
          <Button type="submit" variant="primary" loading={adding} className="sm:mt-[22px]">
            Add member
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2">
          <CardTitle>Members</CardTitle>
          <Badge>{members.length}</Badge>
        </div>
        <ul className="mt-4 divide-y divide-line">
          <AnimatePresence initial={false}>
            {members.map((m) => (
              <motion.li
                key={m.userId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {initialsOf(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {m.name}
                    {m.isYou && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                <Badge tone={m.role === "ngo_admin" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                {!m.isYou && (
                  <ConfirmButton
                    size="sm"
                    label="Remove"
                    question={`Remove ${m.name}?`}
                    confirmLabel="Remove"
                    onConfirm={() => remove(m)}
                  />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Card>
    </div>
  );
}

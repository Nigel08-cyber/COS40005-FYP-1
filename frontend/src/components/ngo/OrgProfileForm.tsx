"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SkillTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Placeholder } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipPicker, FieldLabel, FileField, FormSection, LabeledSelect, RemovableChips, toggle } from "@/components/staff/FormParts";
import { ApprovalBanner, NotSavedHint } from "@/components/staff/StaffNotices";
import { useStaff } from "@/components/staff/StaffShell";
import { errorMessage } from "@/lib/api/http";
import { saveOrgProfile } from "@/lib/api/ngo";
import type { OrgProfile, OrgProfileData, OrgProfileOptions } from "@/lib/staffTypes";

const PREVIEW_TAGS = 3;
const PHONE_MAX = 20; // backend limit (NgoIn.phone)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"name" | "description" | "registrationNo" | "email" | "phone", string>>;

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

function validate(p: OrgProfile, creating: boolean): Errors {
  const e: Errors = {};
  if (!p.name.trim()) e.name = "Please enter the organisation name.";
  if (!p.description.trim()) e.description = "Please describe what your organisation does.";
  if (creating && !p.registrationNo.trim()) e.registrationNo = "Please enter the registration number.";
  if (p.email.trim() && !EMAIL_RE.test(p.email.trim())) e.email = "Please enter a valid email address.";
  if (p.phone.trim().length > PHONE_MAX) e.phone = `Use at most ${PHONE_MAX} characters.`;
  return e;
}

/**
 * Wireframe 10 · Organisation profile. The first save creates the organisation (it then waits for a
 * platform admin's approval); later saves update it. Fields the backend does not store are marked.
 */
export function OrgProfileForm({ data, options }: { data: OrgProfileData; options: OrgProfileOptions }) {
  const router = useRouter();
  const { notify } = useStaff();
  const [ngoId, setNgoId] = useState(data.ngoId);
  const [status, setStatus] = useState(data.status);
  const [profile, setProfile] = useState(data.profile);
  const [extraActivities, setExtraActivities] = useState<string[]>([]);
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  const [areaDraft, setAreaDraft] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "final" | null>(null);
  const creating = ngoId === null;

  const set = <K extends keyof OrgProfile>(key: K, value: OrgProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addArea = () => {
    const area = areaDraft.trim();
    if (area && !profile.serviceAreas.includes(area)) set("serviceAreas", [...profile.serviceAreas, area]);
    setAreaDraft("");
  };

  const save = async (mode: "draft" | "final") => {
    setFormError(null);
    const found = validate(profile, creating);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setSaving(mode);
    try {
      const saved = await saveOrgProfile(profile, ngoId);
      setNgoId(saved.ngoId);
      setStatus(saved.status);
      if (creating) notify("Organisation created. A platform admin needs to approve it.");
      else notify("Organisation profile saved.");
      if (mode === "final") {
        if (saved.status === "active") router.push("/ngo/projects/new");
        else notify("You can create projects once your organisation is approved.");
      }
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={creating ? "Create your organisation profile" : "Organisation profile"}
        subtitle={creating ? "Step 1 of 2 · Tell volunteers who you are" : "How your organisation appears to volunteers"}
      />
      <ApprovalBanner status={status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <FormSection title="Organisation details">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="orgName"
                label="Organisation name"
                required
                value={profile.name}
                error={errors.name}
                onChange={(v) => set("name", v)}
              />
              <LabeledSelect
                label="Organisation type"
                labelExtra={<NotSavedHint />}
                value={profile.type}
                onChange={(v) => set("type", v)}
                options={options.types}
              />
              <div className="sm:col-span-2">
                <TextField
                  id="orgDescription"
                  label="Description"
                  required
                  placeholder="What does your organisation do? Who do you serve?"
                  value={profile.description}
                  error={errors.description}
                  onChange={(v) => set("description", v)}
                />
              </div>
              <FileField
                label="Logo"
                labelExtra={<NotSavedHint />}
                placeholder="Upload image (PNG/JPG)"
                fileName={profile.logoName}
                onChange={(name) => set("logoName", name)}
              />
              <TextField
                id="registrationNo"
                label="Registration no."
                required={creating}
                labelExtra={creating ? undefined : <span className="ml-1.5 text-[10px] text-faint">Cannot be changed</span>}
                placeholder="e.g. PPM-001-10-12345"
                value={profile.registrationNo}
                error={errors.registrationNo}
                disabled={!creating}
                onChange={(v) => set("registrationNo", v)}
              />
            </div>
          </FormSection>

          <FormSection title="Areas of activity" hint="Choose everything you run activities in">
            {/* Saved areas that are not in the fixed list (typed with "+ Add") still show as chips */}
            <ChipPicker
              items={[...new Set([...options.activities, ...extraActivities, ...profile.areasOfActivity])]}
              selected={profile.areasOfActivity}
              onToggle={(a) => set("areasOfActivity", toggle(profile.areasOfActivity, a))}
              addLabel="Add"
              onAdd={(a) => {
                setExtraActivities((e) => (e.includes(a) ? e : [...e, a]));
                if (!profile.areasOfActivity.includes(a)) set("areasOfActivity", [...profile.areasOfActivity, a]);
              }}
            />
          </FormSection>

          <FormSection title="Service areas" hint="Where you run activities. Used later to calculate volunteer distance.">
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledSelect
                label="State"
                value={profile.state}
                onChange={(v) => set("state", v)}
                options={options.states}
                placeholder={profile.state ? undefined : "Select a state"}
              />
              <div>
                <FieldLabel>Add area / city</FieldLabel>
                <input
                  value={areaDraft}
                  onChange={(e) => setAreaDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArea();
                    }
                  }}
                  onBlur={addArea}
                  placeholder="Type an area name and press Enter"
                  aria-label="Add area or city"
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none placeholder:text-faint hover:border-ink/30 focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </div>
            </div>
            <div className="mt-3">
              <RemovableChips
                items={profile.serviceAreas}
                onRemove={(a) => set("serviceAreas", profile.serviceAreas.filter((x) => x !== a))}
              />
            </div>
          </FormSection>

          <FormSection title="Contact information">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="contactPerson"
                label="Contact person"
                labelExtra={<NotSavedHint />}
                value={profile.contactPerson}
                onChange={(v) => set("contactPerson", v)}
              />
              <TextField
                id="orgEmail"
                label="Email"
                type="email"
                value={profile.email}
                error={errors.email}
                onChange={(v) => set("email", v)}
              />
              <TextField
                id="orgPhone"
                label="Phone"
                type="tel"
                placeholder="+60 3-1234 5678"
                value={profile.phone}
                error={errors.phone}
                onChange={(v) => set("phone", v)}
              />
              <TextField
                id="orgWebsite"
                label="Website"
                type="url"
                placeholder="https://"
                value={profile.website}
                onChange={(v) => set("website", v)}
              />
              <div className="sm:col-span-2">
                <TextField
                  id="officeAddress"
                  label="Office address"
                  value={profile.officeAddress}
                  onChange={(v) => set("officeAddress", v)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Standing volunteer requirements"
            badge={<NotSavedHint />}
            hint="Skills your organisation regularly needs (shown on the skills-gap dashboard)"
          >
            <ChipPicker
              items={[...options.skills, ...extraSkills]}
              selected={profile.standingSkills}
              onToggle={(s) => set("standingSkills", toggle(profile.standingSkills, s))}
              addLabel="Add skill"
              onAdd={(s) => {
                if (!options.skills.includes(s) && !extraSkills.includes(s)) setExtraSkills((e) => [...e, s]);
                if (!profile.standingSkills.includes(s)) set("standingSkills", [...profile.standingSkills, s]);
              }}
            />
            <div className="mt-4 max-w-sm">
              <TextField
                id="typicalVolunteers"
                label="Typical volunteers needed per project"
                type="number"
                min={1}
                placeholder="e.g. 20"
                value={profile.typicalVolunteers}
                onChange={(v) => set("typicalVolunteers", v)}
              />
            </div>
          </FormSection>

          {formError && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" loading={saving === "draft"} disabled={!!saving} onClick={() => save("draft")}>
              {creating ? "Save as draft" : "Save changes"}
            </Button>
            <Button variant="primary" loading={saving === "final"} disabled={!!saving} onClick={() => save("final")}>
              Save &amp; create first project
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Card className="p-5">
            <CardTitle>How volunteers will see you</CardTitle>
            <Placeholder label="Cover image" className="mt-3 h-24" />
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-xs font-semibold text-ink-soft">
                {initialsOf(profile.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile.name || "Organisation name"}</p>
                <p className="truncate text-xs text-muted">
                  {[profile.serviceAreas[0], profile.state].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
            {profile.areasOfActivity.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.areasOfActivity.slice(0, PREVIEW_TAGS).map((a) => (
                  <SkillTag key={a} tone="brand">
                    {a}
                  </SkillTag>
                ))}
                {profile.areasOfActivity.length > PREVIEW_TAGS && (
                  <SkillTag>+{profile.areasOfActivity.length - PREVIEW_TAGS}</SkillTag>
                )}
              </div>
            )}
            <p className={profile.description.trim() ? "mt-3 text-xs leading-relaxed text-ink-soft" : "mt-3 text-xs italic text-faint"}>
              {profile.description.trim() || "Your description will appear here."}
            </p>
          </Card>

          <Card className="p-5">
            <CardTitle>Next steps</CardTitle>
            <ol className="mt-3 space-y-2.5 text-sm text-ink-soft">
              {[
                { label: "Create your first project", href: status === "active" ? "/ngo/projects/new" : undefined },
                { label: "Invite Project Coordinators" },
                { label: "Review AI recommendations" },
              ].map((step, i) => (
                <li key={step.label} className="flex items-center gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[10px] font-medium">
                    {i + 1}
                  </span>
                  {step.href ? (
                    <Link href={step.href} className="rounded hover:text-brand hover:underline">
                      {step.label}
                    </Link>
                  ) : (
                    step.label
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

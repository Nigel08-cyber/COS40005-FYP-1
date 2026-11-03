"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Placeholder } from "@/components/ui/Card";
import { TextArea, TextField } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipPicker, FieldLabel, FormSection, LabeledSelect, toggle } from "@/components/staff/FormParts";
import { useStaff } from "@/components/staff/StaffShell";
import { saveProject } from "@/lib/api/ngo";
import { formatLongDate, formatShortDate, formatTime, formatTimeRange } from "@/lib/format";
import type { LikelyMatches, ProjectDraft, ProjectFormOptions } from "@/lib/staffTypes";

/** "08:00" -> "8:00 AM" (format.ts expects a full "date T time" value) */
const time = (hhmm: string) => formatTime(`2000-01-01T${hhmm}`);

/** Wireframe 12 · Create a project. */
export function ProjectForm({
  initialDraft,
  options,
  matches,
}: {
  initialDraft: ProjectDraft;
  options: ProjectFormOptions;
  matches: LikelyMatches;
}) {
  const router = useRouter();
  const { notify } = useStaff();
  const [draft, setDraft] = useState(initialDraft);
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const timeOptions = options.times.map((t) => ({ value: t, label: time(t) }));

  const save = async (mode: "draft" | "publish") => {
    setSaving(mode);
    await saveProject(draft, mode);
    setSaving(null);
    if (mode === "draft") {
      notify("Project draft saved.");
    } else {
      notify("Project published.");
      router.push("/ngo/projects");
    }
  };

  const summaryDate = draft.date
    ? `${formatShortDate(draft.date)} · ${formatTimeRange(`${draft.date}T${draft.startTime}`, `${draft.date}T${draft.endTime}`)}`
    : "Not set";

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="mb-2 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/ngo/projects" className="rounded hover:text-brand hover:underline">
          Projects
        </Link>
        <span className="mx-1.5">→</span>
        <span className="text-ink-soft">New project</span>
      </nav>
      <PageHeader title="Create a project" />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <FormSection title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField id="projectTitle" label="Project title" required value={draft.title} onChange={(v) => set("title", v)} />
              </div>
              <LabeledSelect label="Category" required value={draft.category} onChange={(v) => set("category", v)} options={options.categories} />
              <LabeledSelect
                label="Project coordinator"
                required
                value={draft.coordinatorId}
                onChange={(v) => set("coordinatorId", v)}
                placeholder="Select a coordinator"
                options={options.coordinators.map((c) => ({ value: c.id, label: c.name }))}
              />
              <div className="sm:col-span-2">
                <TextField
                  id="projectDescription"
                  label="Description"
                  placeholder="Describe the activity, what volunteers will do and what to bring"
                  value={draft.description}
                  onChange={(v) => set("description", v)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Date & time">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="projectDate" label="Date" required type="date" value={draft.date} onChange={(v) => set("date", v)} />
              <LabeledSelect label="Start time" value={draft.startTime} onChange={(v) => set("startTime", v)} options={timeOptions} />
              <LabeledSelect label="End time" value={draft.endTime} onChange={(v) => set("endTime", v)} options={timeOptions} />
            </div>
            <label className="group mt-3 flex w-fit items-center gap-2.5 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={draft.repeatWeekly}
                onChange={(e) => set("repeatWeekly", e.target.checked)}
                className="size-4 rounded border-line-strong accent-brand"
              />
              <span className="group-hover:text-ink">Repeat weekly</span>
            </label>
          </FormSection>

          <FormSection title="Location" hint="Geocoded once when saved, to compute volunteer distance">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <TextField id="venue" label="Venue / address" required value={draft.venue} onChange={(v) => set("venue", v)} />
              <LabeledSelect label="Area" value={draft.area} onChange={(v) => set("area", v)} options={options.areas} />
            </div>
            <Placeholder label="Map preview placeholder" className="mt-4 h-32" />
          </FormSection>

          <FormSection title="Volunteers & requirements">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                id="volunteersRequired"
                label="Volunteers required"
                required
                type="number"
                min={1}
                value={draft.volunteersRequired}
                onChange={(v) => set("volunteersRequired", v)}
              />
              <LabeledSelect
                label="Minimum experience"
                value={draft.minExperience}
                onChange={(v) => set("minExperience", v)}
                options={options.experienceLevels}
              />
              <LabeledSelect label="Language" value={draft.language} onChange={(v) => set("language", v)} options={options.languages} />
            </div>

            <div className="mt-4">
              <FieldLabel>Required skills</FieldLabel>
              <ChipPicker
                items={[...options.skills, ...extraSkills]}
                selected={draft.skills}
                onToggle={(s) => set("skills", toggle(draft.skills, s))}
                addLabel="Add skill"
                onAdd={(s) => {
                  if (!options.skills.includes(s) && !extraSkills.includes(s)) setExtraSkills((e) => [...e, s]);
                  if (!draft.skills.includes(s)) set("skills", [...draft.skills, s]);
                }}
              />
            </div>

            <p className="mb-2 mt-5 text-xs font-medium">Preferred availability</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <LabeledSelect label="Day" value={draft.preferredDay} onChange={(v) => set("preferredDay", v)} options={options.days} />
              <LabeledSelect label="From" value={draft.preferredFrom} onChange={(v) => set("preferredFrom", v)} options={timeOptions} />
              <LabeledSelect label="To" value={draft.preferredTo} onChange={(v) => set("preferredTo", v)} options={timeOptions} />
            </div>

            <div className="mt-4">
              <TextArea
                id="additionalRequirements"
                label="Additional requirements (free text)"
                placeholder="e.g. Must be comfortable lifting 10 kg, experience working with families"
                value={draft.additionalRequirements}
                onChange={(v) => set("additionalRequirements", v)}
              />
            </div>
          </FormSection>

          <FormSection title="Application settings">
            <div className="space-y-2.5">
              <SettingCheckbox
                label="Volunteers must apply and be approved before registering"
                checked={draft.requireApproval}
                onChange={(v) => set("requireApproval", v)}
              />
              <SettingCheckbox
                label="Generate AI volunteer recommendations after publishing"
                checked={draft.generateAiRecommendations}
                onChange={(v) => set("generateAiRecommendations", v)}
              />
            </div>
          </FormSection>

          <div className="flex justify-end gap-3 pt-1">
            <Button href="/ngo/projects" variant="outline">
              Cancel
            </Button>
            <Button variant="outline" loading={saving === "draft"} disabled={!!saving} onClick={() => save("draft")}>
              Save draft
            </Button>
            <Button variant="primary" loading={saving === "publish"} disabled={!!saving} onClick={() => save("publish")}>
              Publish project
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Card className="p-5">
            <CardTitle>Summary</CardTitle>
            <dl className="mt-3 space-y-2.5 text-xs">
              <SummaryRow label="Date" value={summaryDate} title={draft.date ? formatLongDate(draft.date) : undefined} />
              <SummaryRow label="Location" value={draft.area || "Not set"} />
              <SummaryRow label="Volunteers" value={`0 / ${draft.volunteersRequired || "–"}`} />
            </dl>
          </Card>

          <Card className="p-5">
            <CardTitle>Likely matches</CardTitle>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Recommendations only. Your coordinator makes the final decision.
            </p>
            <Badge tone="brand" className="mt-3">
              {matches.potentialCount} potential volunteers
            </Badge>
            <ul className="mt-3 space-y-2.5">
              {matches.top.map((m) => (
                <li key={m.label} className="flex items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[10px] font-medium text-ink-soft">
                    {m.label.split(" ").pop()}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">{m.label}</span>
                    <span className="block text-[11px] text-muted">{m.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Shown after you save. Full ranking is available on the AI recommendations screen.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink" title={title}>
        {value}
      </dd>
    </div>
  );
}

function SettingCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="group flex w-fit items-center gap-2.5 text-sm text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line-strong accent-brand"
      />
      <span className="group-hover:text-ink">{label}</span>
    </label>
  );
}

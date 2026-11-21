"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Placeholder } from "@/components/ui/Card";
import { TextArea, TextField } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipPicker, FieldLabel, FormSection, LabeledSelect, TimeSelect, toggle } from "@/components/staff/FormParts";
import { ApprovalBanner, ComingSoonCard, NotSavedHint } from "@/components/staff/StaffNotices";
import { useStaff } from "@/components/staff/StaffShell";
import { errorMessage, todayInMalaysia } from "@/lib/api/http";
import { saveProject } from "@/lib/api/ngo";
import { formatLongDate, formatShortDate, formatTime, formatTimeRange } from "@/lib/format";
import type { ProjectDraft, ProjectFormData, ProjectSession } from "@/lib/staffTypes";

/** "08:00" -> "8:00 AM" (format.ts expects a full "date T time" value) */
const time = (hhmm: string) => formatTime(`2000-01-01T${hhmm}`);

const MAX_SESSIONS = 30;

type SessionErrors = Record<string, { date?: string; endTime?: string }>;
type Errors = Partial<Record<"title" | "venue" | "volunteersRequired" | "coordinatorId", string>> & { sessions?: SessionErrors };

type Mode = "draft" | "publish" | "update";

/**
 * A draft only needs a title; publishing (or saving a published project) needs everything volunteers see.
 * A past date is only refused when it was changed (an older project can still be edited).
 */
function validate(d: ProjectDraft, mode: Mode, hasCoordinators: boolean, saved: ProjectSession[]): Errors {
  const e: Errors = {};
  if (!d.title.trim()) e.title = "Please enter a project title.";
  const sessions: SessionErrors = {};
  d.sessions.forEach((s, i) => {
    const row: SessionErrors[string] = {};
    const savedDate = saved.find((x) => x.key === s.key)?.date;
    if (!s.date) {
      if (mode !== "draft") row.date = "Please choose a date.";
    } else if (mode !== "draft" && s.date < todayInMalaysia() && s.date !== savedDate) {
      row.date = "The date is in the past.";
    } else if (d.sessions.slice(0, i).some((o) => o.date === s.date && s.startTime < o.endTime && o.startTime < s.endTime)) {
      row.date = "This overlaps another time on the same day.";
    }
    if (s.date && s.endTime <= s.startTime) row.endTime = "The end time must be after the start time.";
    if (row.date || row.endTime) sessions[s.key] = row;
  });
  if (Object.keys(sessions).length) e.sessions = sessions;
  if (mode === "draft") return e;
  if (!d.venue.trim()) e.venue = "Please enter the venue or address.";
  if (!(Number(d.volunteersRequired) > 0)) e.volunteersRequired = "Enter how many volunteers you need.";
  if (hasCoordinators && !d.coordinatorId) e.coordinatorId = "Please choose a project coordinator.";
  return e;
}

/**
 * Wireframe 12 · Create a project, also used to continue a draft or edit a published project.
 * Save draft = status "draft"; Publish = status "active" with one session per date; Save changes = update a published project.
 */
export function ProjectForm({ data }: { data: ProjectFormData }) {
  const router = useRouter();
  const { notify } = useStaff();
  const { options } = data;
  const [draft, setDraft] = useState(data.draft);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Mode | null>(null);
  const canSave = data.status === "active" && data.ngoId !== null;
  const { existing } = data;
  const isPublished = !!existing && existing.status !== "draft";
  const backHref = existing ? `/ngo/projects/${existing.projectId}` : "/ngo/projects";
  const heading = !existing ? "Create a project" : isPublished ? "Edit project" : "Continue draft";

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  // A saved time that is not on the hour stays selectable.
  const sessionTimeOptions = (current: string) =>
    [...new Set([...options.sessionTimes, current])].sort().map((t) => ({ value: t, label: time(t) }));

  const nextRow = useRef(0);
  const clearSessionError = (key: string) =>
    setErrors((e) => {
      if (!e.sessions?.[key]) return e;
      const sessions = { ...e.sessions };
      delete sessions[key];
      return { ...e, sessions: Object.keys(sessions).length ? sessions : undefined };
    });
  const setSession = (key: string, change: Partial<ProjectSession>) => {
    setDraft((d) => ({ ...d, sessions: d.sessions.map((s) => (s.key === key ? { ...s, ...change } : s)) }));
    clearSessionError(key);
  };
  const addSession = () => {
    nextRow.current += 1;
    const key = `new-${nextRow.current}`;
    setDraft((d) => {
      const last = d.sessions.at(-1);
      const row: ProjectSession = {
        key,
        eventId: null,
        date: "",
        startTime: last?.startTime ?? "08:00",
        endTime: last?.endTime ?? "13:00",
        registered: 0,
      };
      return { ...d, sessions: [...d.sessions, row] };
    });
  };
  const removeSession = (key: string) => {
    setDraft((d) => ({ ...d, sessions: d.sessions.filter((s) => s.key !== key) }));
    clearSessionError(key);
  };

  const save = async (mode: Mode) => {
    if (data.ngoId === null) return;
    setFormError(null);
    const found = validate(draft, mode, options.coordinators.length > 0, data.draft.sessions);
    setErrors(found);
    if (Object.keys(found).length) {
      const { sessions, ...fields } = found;
      const sessionMessages = Object.values(sessions ?? {}).flatMap((s) => [s.date, s.endTime]);
      setFormError([...new Set([...Object.values(fields), ...sessionMessages].filter(Boolean))].join(" "));
      return;
    }
    setSaving(mode);
    try {
      const { id } = await saveProject(draft, data.ngoId, mode, existing);
      notify(
        mode === "draft"
          ? "Project saved as a draft."
          : mode === "update"
            ? "Changes saved."
            : "Project published. Volunteers can now apply.",
      );
      // Next keeps this page alive after leaving it, so start from an empty form next time.
      setDraft(data.draft);
      setErrors({});
      setSaving(null);
      router.push(existing || mode !== "draft" ? `/ngo/projects/${id}` : "/ngo/projects");
    } catch (e) {
      setFormError(errorMessage(e));
      setSaving(null);
    }
  };

  const datedSessions = draft.sessions.filter((s) => s.date).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const firstSession = datedSessions[0];
  const lastSession = datedSessions.at(-1);
  const summaryDate = !firstSession
    ? "Not set"
    : datedSessions.length === 1
      ? `${formatShortDate(firstSession.date)} · ${formatTimeRange(`${firstSession.date}T${firstSession.startTime}`, `${firstSession.date}T${firstSession.endTime}`)}`
      : `${datedSessions.length} dates · ${formatShortDate(firstSession.date)} – ${formatShortDate(lastSession!.date)}`;

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="mb-2 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/ngo/projects" className="rounded hover:text-brand hover:underline">
          Projects
        </Link>
        {existing && (
          <>
            <span className="mx-1.5">→</span>
            <Link href={backHref} className="rounded hover:text-brand hover:underline">
              {data.draft.title || "Untitled project"}
            </Link>
          </>
        )}
        <span className="mx-1.5">→</span>
        <span className="text-ink-soft">{existing ? (isPublished ? "Edit" : "Continue draft") : "New project"}</span>
      </nav>
      <PageHeader title={heading} />
      <ApprovalBanner status={data.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <FormSection title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  id="projectTitle"
                  label="Project title"
                  required
                  placeholder="e.g. Community Food Distribution"
                  value={draft.title}
                  error={errors.title}
                  onChange={(v) => set("title", v)}
                />
              </div>
              <LabeledSelect label="Category" required value={draft.category} onChange={(v) => set("category", v)} options={options.categories} />
              <div>
                <LabeledSelect
                  label="Project coordinator"
                  required
                  value={draft.coordinatorId}
                  onChange={(v) => set("coordinatorId", v)}
                  placeholder={options.coordinators.length ? "Select a coordinator" : "No members yet"}
                  options={options.coordinators.map((c) => ({ value: c.id, label: c.name }))}
                />
                {errors.coordinatorId && <p className="pt-1 text-xs text-danger">{errors.coordinatorId}</p>}
              </div>
              <div className="sm:col-span-2">
                <TextArea
                  id="projectDescription"
                  label="Description"
                  rows={6}
                  placeholder="Describe the activity, what volunteers will do and what to bring. Line breaks are kept."
                  value={draft.description}
                  onChange={(v) => set("description", v)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Date & time">
            <div className="space-y-3">
              {draft.sessions.map((s, i) => (
                <div key={s.key} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_1fr_2.25rem]">
                  <TextField
                    id={i === 0 ? "projectDate" : `projectDate-${s.key}`}
                    label={draft.sessions.length > 1 ? `Date ${i + 1}` : "Date"}
                    required
                    type="date"
                    min={todayInMalaysia()}
                    value={s.date}
                    error={errors.sessions?.[s.key]?.date}
                    onChange={(v) => setSession(s.key, { date: v })}
                  />
                  <TimeSelect
                    label="Start time"
                    value={s.startTime}
                    onChange={(v) => setSession(s.key, { startTime: v })}
                    options={sessionTimeOptions(s.startTime)}
                  />
                  <div>
                    <TimeSelect
                      label="End time"
                      value={s.endTime}
                      onChange={(v) => setSession(s.key, { endTime: v })}
                      options={sessionTimeOptions(s.endTime)}
                    />
                    {errors.sessions?.[s.key]?.endTime && (
                      <p className="pt-1 text-xs text-danger">{errors.sessions[s.key].endTime}</p>
                    )}
                  </div>
                  {draft.sessions.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove date ${i + 1}`}
                      title={s.registered ? "Volunteers have registered for this date" : `Remove date ${i + 1}`}
                      disabled={s.registered > 0}
                      onClick={() => removeSession(s.key)}
                      className="flex size-9 items-center justify-center rounded-lg border border-line-strong text-muted hover:border-danger/50 hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:bg-transparent disabled:hover:text-muted sm:mt-[22px] sm:size-10"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={draft.sessions.length >= MAX_SESSIONS}
              onClick={addSession}
              className="mt-3 rounded-full border border-dashed border-line-strong px-3 py-1 text-xs text-ink-soft hover:-translate-y-px hover:border-brand hover:text-brand active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              + Add another date
            </button>
            <label className="group mt-3 flex w-fit items-center gap-2.5 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={draft.repeatWeekly}
                onChange={(e) => set("repeatWeekly", e.target.checked)}
                className="size-4 rounded border-line-strong accent-brand"
              />
              <span className="group-hover:text-ink">Repeat weekly</span>
              <NotSavedHint className="ml-0" />
            </label>
          </FormSection>

          <FormSection title="Location" hint="Shown to volunteers on the opportunity page">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <TextField
                id="venue"
                label="Venue / address"
                required
                placeholder="e.g. Dewan Komuniti, SS 15"
                value={draft.venue}
                error={errors.venue}
                onChange={(v) => set("venue", v)}
              />
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
                placeholder="e.g. 20"
                value={draft.volunteersRequired}
                error={errors.volunteersRequired}
                onChange={(v) => set("volunteersRequired", v)}
              />
              <LabeledSelect
                label="Minimum experience"
                value={draft.minExperience}
                onChange={(v) => set("minExperience", v)}
                options={options.experienceLevels}
              />
              <LabeledSelect
                label="Language"
                labelExtra={<NotSavedHint />}
                value={draft.language}
                onChange={(v) => set("language", v)}
                options={options.languages}
              />
            </div>

            <div className="mt-4">
              <FieldLabel>Required skills</FieldLabel>
              {options.skills.length ? (
                <ChipPicker items={options.skills} selected={draft.skills} onToggle={(s) => set("skills", toggle(draft.skills, s))} />
              ) : (
                <p className="text-xs text-muted">No skills have been added to the platform yet (a platform admin adds them).</p>
              )}
            </div>

            <div className="mt-4">
              <TextArea
                id="additionalRequirements"
                label="Additional requirements (free text)"
                labelExtra={<NotSavedHint />}
                placeholder="e.g. Must be comfortable lifting 10 kg, experience working with families"
                value={draft.additionalRequirements}
                onChange={(v) => set("additionalRequirements", v)}
                rows={6}
              />
            </div>
          </FormSection>

          <FormSection title="Application settings" badge={<NotSavedHint />}>
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

          {formError && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button href={backHref} variant="outline">
              Cancel
            </Button>
            {isPublished ? (
              <Button variant="primary" loading={saving === "update"} disabled={!!saving || !canSave} onClick={() => save("update")}>
                Save changes
              </Button>
            ) : (
              <>
                <Button variant="outline" loading={saving === "draft"} disabled={!!saving || !canSave} onClick={() => save("draft")}>
                  Save draft
                </Button>
                <Button variant="primary" loading={saving === "publish"} disabled={!!saving || !canSave} onClick={() => save("publish")}>
                  Publish project
                </Button>
              </>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Card className="p-5">
            <CardTitle>Summary</CardTitle>
            <dl className="mt-3 space-y-2.5 text-xs">
              <SummaryRow label="Date" value={summaryDate} title={datedSessions.length ? datedSessions.map((s) => formatLongDate(s.date)).join(", ") : undefined} />
              <SummaryRow label="Location" value={[draft.venue.trim(), draft.area].filter(Boolean).join(", ") || "Not set"} />
              <SummaryRow label="Volunteers" value={`0 / ${draft.volunteersRequired || "–"}`} />
            </dl>
          </Card>

          <ComingSoonCard
            title="Likely matches"
            description="AI-suggested volunteers for this project will appear here once the matching service is connected. Your coordinator always makes the final decision."
          />
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

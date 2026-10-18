"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AnimatedHeight } from "@/components/ui/AnimatedHeight";
import { Badge, SkillTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Placeholder } from "@/components/ui/Card";
import { Chip, Select, TextArea, TextField } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { saveVolunteerProfile } from "@/lib/api/volunteer";
import { cx } from "@/lib/format";
import type {
  AvailabilitySlot,
  ContributionRecord,
  DayPart,
  ProfileOptions,
  VolunteerProfile,
  Weekday,
} from "@/lib/types";
import { useVolunteer } from "./VolunteerProvider";

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_PARTS: DayPart[] = ["Morning", "Afternoon", "Evening"];

type ListKey = "skills" | "languages" | "interests";

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Each filled item counts equally towards "Profile completeness". */
function completeness(p: VolunteerProfile) {
  const filled = [
    p.fullName.trim(),
    p.email.trim(),
    p.phone.trim(),
    p.photoName,
    p.skills.length,
    p.qualifications.trim(),
    p.languages.length,
    p.interests.length,
    p.availability.length,
    p.area.trim(),
    p.experience.trim(),
  ];
  return Math.floor((filled.filter(Boolean).length / filled.length) * 100);
}

function checklist(p: VolunteerProfile) {
  return [
    { label: "Basic information", done: !!(p.fullName.trim() && p.email.trim() && p.phone.trim()) },
    { label: "Skills", done: p.skills.length > 0 },
    { label: "Availability", done: p.availability.length > 0 },
    { label: "Experience", done: !!p.experience.trim() },
  ];
}

/**
 * Volunteer profile (wireframe 09b).
 * Opens read-only; "Edit profile" switches to the form, which then shows Cancel / Save profile.
 */
export function ProfileForm({
  initialProfile,
  options,
  history,
}: {
  initialProfile: VolunteerProfile;
  options: ProfileOptions;
  history: ContributionRecord[];
}) {
  const { notify } = useVolunteer();
  const [saved, setSaved] = useState(initialProfile);
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  // Skills / languages the volunteer typed in themselves are added to the chip list
  const [extra, setExtra] = useState<Record<ListKey, string[]>>({ skills: [], languages: [], interests: [] });
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const set = <K extends keyof VolunteerProfile>(key: K, value: VolunteerProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));
  const toggleIn = (key: ListKey, item: string) => setProfile((p) => ({ ...p, [key]: toggle(p[key], item) }));
  const addOwn = (key: ListKey, item: string) => {
    if (!options[key].includes(item) && !extra[key].includes(item)) {
      setExtra((e) => ({ ...e, [key]: [...e[key], item] }));
    }
    setProfile((p) => (p[key].includes(item) ? p : { ...p, [key]: [...p[key], item] }));
  };

  const startEditing = () => {
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    setSaving(true);
    await saveVolunteerProfile(profile);
    setSaving(false);
    setSaved(profile);
    setEditing(false);
    notify("Profile saved.");
  };

  const cancel = () => {
    setProfile(saved);
    setEditing(false);
    if (dirty) notify("Changes discarded.");
  };

  const editButton = (
    <Button variant="primary" onClick={startEditing}>
      <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
        <path
          d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      Edit profile
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Your volunteer profile"
        subtitle="Complete your profile so NGOs and the AI matcher can recommend the right activities for you."
        actions={
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.div key="editing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Badge tone="brand">Editing</Badge>
              </motion.div>
            ) : (
              <motion.div key="view" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {editButton}
              </motion.div>
            )}
          </AnimatePresence>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Section title="1. Basic information" editing={editing}>
            <div className="grid gap-4 sm:grid-cols-2">
              {editing ? (
                <>
                  <TextField
                    id="fullName"
                    label="Full name"
                    required
                    autoComplete="name"
                    value={profile.fullName}
                    onChange={(v) => set("fullName", v)}
                  />
                  <TextField
                    id="email"
                    label="Email"
                    required
                    type="email"
                    autoComplete="email"
                    value={profile.email}
                    onChange={(v) => set("email", v)}
                  />
                  <TextField
                    id="phone"
                    label="Phone"
                    required
                    type="tel"
                    autoComplete="tel"
                    placeholder="+60 12-345 6789"
                    value={profile.phone}
                    onChange={(v) => set("phone", v)}
                  />
                  <PhotoField fileName={profile.photoName} onChange={(name) => set("photoName", name)} />
                </>
              ) : (
                <>
                  <ReadValue label="Full name" value={profile.fullName} />
                  <ReadValue label="Email" value={profile.email} />
                  <ReadValue label="Phone" value={profile.phone} />
                  <ReadValue label="Profile photo" value={profile.photoName} empty="No photo uploaded" />
                </>
              )}
            </div>
          </Section>

          <Section
            title="2. Skills & qualifications"
            hint={editing ? "Select all that apply or add your own" : undefined}
            editing={editing}
          >
            {editing ? (
              <>
                <ChipGroup
                  items={[...options.skills, ...extra.skills]}
                  selected={profile.skills}
                  onToggle={(s) => toggleIn("skills", s)}
                  addLabel="Add skill"
                  onAdd={(s) => addOwn("skills", s)}
                />
                <div className="mt-4">
                  <TextField
                    id="qualifications"
                    label="Qualifications / certifications"
                    placeholder="e.g. Certified First Aid responder, B.Ed (Education)"
                    value={profile.qualifications}
                    onChange={(v) => set("qualifications", v)}
                  />
                  <p className="mt-2 text-[11px] text-muted">
                    Free-text entries are read by the semantic matcher, so describe things in your own words.
                  </p>
                </div>
              </>
            ) : (
              <>
                <SelectedTags items={profile.skills} empty="No skills added yet" />
                <div className="mt-4">
                  <ReadValue
                    label="Qualifications / certifications"
                    value={profile.qualifications}
                    empty="No qualifications added yet"
                  />
                </div>
              </>
            )}
          </Section>

          <Section title="3. Languages" editing={editing}>
            {editing ? (
              <ChipGroup
                items={[...options.languages, ...extra.languages]}
                selected={profile.languages}
                onToggle={(l) => toggleIn("languages", l)}
                addLabel="Add language"
                onAdd={(l) => addOwn("languages", l)}
              />
            ) : (
              <SelectedTags items={profile.languages} empty="No languages added yet" />
            )}
          </Section>

          <Section title="4. Areas of interest & preferred activities" editing={editing}>
            {editing ? (
              <ChipGroup
                items={options.interests}
                selected={profile.interests}
                onToggle={(i) => toggleIn("interests", i)}
              />
            ) : (
              <SelectedTags items={profile.interests} empty="No interests added yet" />
            )}
          </Section>

          <Section
            title="5. Availability"
            hint={editing ? "Tap cells to mark when you are usually free" : undefined}
            editing={editing}
          >
            <AvailabilityGrid
              value={profile.availability}
              editable={editing}
              onToggle={(slot) => set("availability", toggle(profile.availability, slot))}
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {editing ? (
                <>
                  <LabeledSelect
                    label="How often can you volunteer?"
                    value={profile.frequency}
                    onChange={(v) => set("frequency", v)}
                    options={options.frequencies}
                  />
                  <LabeledSelect
                    label="Preferred time of day"
                    value={profile.preferredTime}
                    onChange={(v) => set("preferredTime", v)}
                    options={options.preferredTimes}
                  />
                </>
              ) : (
                <>
                  <ReadValue label="How often can you volunteer?" value={profile.frequency} />
                  <ReadValue label="Preferred time of day" value={profile.preferredTime} />
                </>
              )}
            </div>
          </Section>

          <Section title="6. Location / area" editing={editing}>
            <div className="grid gap-4 sm:grid-cols-3">
              {editing ? (
                <>
                  <LabeledSelect
                    label="State"
                    value={profile.state}
                    onChange={(v) => set("state", v)}
                    options={options.states}
                  />
                  <TextField id="area" label="Area / city" value={profile.area} onChange={(v) => set("area", v)} />
                  <LabeledSelect
                    label="Max travel distance"
                    value={String(profile.maxDistanceKm)}
                    onChange={(v) => set("maxDistanceKm", Number(v))}
                    options={options.distancesKm.map(String)}
                    format={(v) => `Within ${v} km`}
                  />
                </>
              ) : (
                <>
                  <ReadValue label="State" value={profile.state} />
                  <ReadValue label="Area / city" value={profile.area} />
                  <ReadValue label="Max travel distance" value={`Within ${profile.maxDistanceKm} km`} />
                </>
              )}
            </div>
            <Placeholder label="Map preview placeholder (geocoded once on save)" className="mt-4 h-28" />
          </Section>

          <Section title="7. Volunteer experience" editing={editing}>
            {editing ? (
              <TextArea
                id="experience"
                label="Previous volunteer experience"
                placeholder='Describe roles you have done, e.g. "Worked as a teaching assistant at a primary school"'
                value={profile.experience}
                onChange={(v) => set("experience", v)}
              />
            ) : (
              <ReadValue
                label="Previous volunteer experience"
                value={profile.experience}
                empty="Not added yet — click Edit profile to describe roles you have done."
              />
            )}
            <p className="mb-2 mt-4 text-xs font-medium">Volunteer history (updates automatically after attended activities)</p>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Activity</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Hours</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {history.map((r) => (
                    <tr key={r.id} className="transition-colors duration-200 hover:bg-brand-soft/50">
                      <td className="px-4 py-2.5">{r.activity}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.date}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.hours}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Bottom bar: "Edit profile" while viewing, "Cancel" + "Save profile" while editing */}
          <div className="flex min-h-10 items-center justify-end gap-3 pt-1">
            <AnimatePresence mode="wait" initial={false}>
              {editing ? (
                <motion.div
                  key="edit-actions"
                  className="flex w-full items-center justify-end gap-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
                >
                  <AnimatePresence>
                    {dirty && (
                      <motion.span
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className="mr-auto text-xs text-warning"
                      >
                        ● Unsaved changes
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <Button variant="outline" disabled={saving} onClick={cancel}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={saving} onClick={save}>
                    Save profile
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="view-actions"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
                >
                  {editButton}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <CompletenessCard profile={profile} />
          <Card className="p-5">
            <CardTitle>How your profile is used</CardTitle>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              Skills, availability, location and experience are compared with project requirements to recommend
              activities. You can always decline a recommendation.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Contact details are only visible to coordinators of projects you join.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

/** Card for one form section. Its content cross-fades and its height glides when switching view/edit. */
function Section({
  title,
  hint,
  editing,
  children,
}: {
  title: string;
  hint?: string;
  editing: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cx("p-5 transition-[border-color,box-shadow] duration-300", editing && "border-brand-line/70 shadow-sm")}>
      <CardTitle>{title}</CardTitle>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <AnimatedHeight>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={editing ? "edit" : "view"}
            className="pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </AnimatedHeight>
    </Card>
  );
}

/** Read-only label + value used in view mode. */
function ReadValue({ label, value, empty = "Not added yet" }: { label: string; value: string; empty?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className={cx("whitespace-pre-line text-sm", value.trim() ? "text-ink" : "italic text-faint")}>
        {value.trim() || empty}
      </p>
    </div>
  );
}

function SelectedTags({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm italic text-faint">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <SkillTag key={item} tone="brand" className="py-1">
          {item}
        </SkillTag>
      ))}
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  format = (v) => v,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  format?: (value: string) => string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      <Select label={label} value={value} onChange={onChange} options={options.map((o) => ({ value: o, label: format(o) }))} />
    </div>
  );
}

/** Upload box. Only the file name is kept for now — uploading needs the backend. */
function PhotoField({ fileName, onChange }: { fileName: string; onChange: (name: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">Profile photo</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 text-left text-sm hover:border-ink/30 hover:bg-canvas"
      >
        <span className={cx("truncate", fileName ? "text-ink" : "text-faint")}>{fileName || "Upload image"}</span>
        <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-muted" aria-hidden>
          <path d="M8 11V3M5 6l3-3 3 3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function ChipGroup({
  items,
  selected,
  onToggle,
  addLabel,
  onAdd,
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  addLabel?: string;
  onAdd?: (item: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const value = draft.trim();
    if (value && onAdd) onAdd(value);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.span key={item} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <Chip label={item} active={selected.includes(item)} onToggle={() => onToggle(item)} />
          </motion.span>
        ))}
      </AnimatePresence>
      {addLabel && onAdd && (
        <motion.span layout>
          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              placeholder="Type and press Enter"
              aria-label={addLabel}
              className="h-7 w-44 rounded-full border border-brand bg-surface px-3 text-xs outline-none ring-4 ring-brand/10"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-ink-soft hover:-translate-y-px hover:border-brand hover:text-brand active:scale-95"
            >
              + {addLabel}
            </button>
          )}
        </motion.span>
      )}
    </div>
  );
}

function AvailabilityGrid({
  value,
  editable,
  onToggle,
}: {
  value: AvailabilitySlot[];
  editable: boolean;
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1.5 text-xs">
        <thead>
          <tr>
            <th />
            {WEEKDAYS.map((d) => (
              <th key={d} className="font-normal text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_PARTS.map((part) => (
            <tr key={part}>
              <th scope="row" className="pr-4 text-left font-normal text-ink-soft">
                {part}
              </th>
              {WEEKDAYS.map((day) => {
                const slot: AvailabilitySlot = `${day}-${part}`;
                const free = value.includes(slot);
                return (
                  <td key={slot}>
                    <button
                      type="button"
                      aria-pressed={free}
                      aria-label={`${day} ${part}`}
                      disabled={!editable}
                      onClick={() => onToggle(slot)}
                      className={cx(
                        "h-8 w-11 rounded-md border text-[11px] disabled:cursor-default sm:w-14",
                        editable && "hover:-translate-y-px active:scale-95",
                        free ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface",
                        editable && !free && "hover:border-brand-line hover:bg-brand-soft/40",
                        !editable && !free && "border-line",
                      )}
                    >
                      <AnimatePresence initial={false}>
                        {free && (
                          <motion.span
                            className="inline-block"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ duration: 0.15 }}
                          >
                            Free
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletenessCard({ profile }: { profile: VolunteerProfile }) {
  const pct = completeness(profile);
  const shown = useMotionValue(pct);
  const rounded = useTransform(shown, (v) => `${Math.round(v)}%`);

  useEffect(() => {
    const controls = animate(shown, pct, { duration: 0.5 });
    return () => controls.stop();
  }, [pct, shown]);

  return (
    <Card className="p-5">
      <CardTitle>Profile completeness</CardTitle>
      <motion.p className="mt-3 text-3xl font-bold tracking-tight">{rounded}</motion.p>
      <div className="mb-1.5 mt-3 flex justify-between text-xs">
        <span className="font-medium">Completeness</span>
        <span className="text-muted">{pct}/100 %</span>
      </div>
      <ProgressBar value={pct} max={100} />
      <ul className="mt-4 space-y-2.5">
        {checklist(profile).map((item) => (
          <li key={item.label} className="flex items-center justify-between text-sm text-ink-soft">
            {item.label}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={String(item.done)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Badge tone={item.done ? "success" : "warning"}>{item.done ? "Done" : "To do"}</Badge>
              </motion.span>
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </Card>
  );
}

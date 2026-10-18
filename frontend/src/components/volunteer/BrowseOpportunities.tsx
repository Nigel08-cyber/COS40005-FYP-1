"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Chip, Select } from "@/components/ui/Fields";
import { Tabs } from "@/components/ui/Tabs";
import { cx, daysBetween, startHour, weekdayIndex } from "@/lib/format";
import type { Category, Language, Opportunity } from "@/lib/types";
import { OpportunityCard } from "./OpportunityCard";

type Tab = "all" | "recommended" | "near";
type Availability = "Weekdays" | "Weekends" | "Evenings";
type Sort = "best" | "soonest" | "nearest";

const PAGE_SIZE = 5;
const MAX_DISTANCE = 100;
const NEAR_ME_KM = 10;
const RECOMMENDED_MIN_MATCH = 70;

const CATEGORIES: Category[] = [
  "Food distribution",
  "Education",
  "Environment",
  "Fundraising",
  "Disaster assistance",
  "Health",
];
const SKILLS = ["Food handling", "Logistics", "First Aid", "Tutoring", "Event setup", "Community interaction"];
const AVAILABILITY: Availability[] = ["Weekdays", "Weekends", "Evenings"];
const LANGUAGES: Language[] = ["English", "Bahasa Malaysia", "Mandarin", "Tamil"];

interface Filters {
  categories: Category[];
  skills: string[];
  availability: Availability[];
  maxDistance: number;
  languages: Language[];
}

const emptyFilters: Filters = { categories: [], skills: [], availability: [], maxDistance: MAX_DISTANCE, languages: [] };

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function matchesAvailability(o: Opportunity, wanted: Availability[]) {
  if (wanted.length === 0) return true;
  const day = weekdayIndex(o.start);
  const weekend = day === 0 || day === 6;
  const evening = startHour(o.start) >= 17;
  return wanted.some((a) =>
    a === "Weekends" ? weekend : a === "Evenings" ? evening : !weekend && !evening,
  );
}

export function BrowseOpportunities({ opportunities, today }: { opportunities: Opportunity[]; today: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [date, setDate] = useState("any");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<Sort>("best");
  const [page, setPage] = useState(1);
  const listTop = useRef<HTMLDivElement>(null);

  // Any change to what is shown starts again from page 1
  const reset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };
  const setFilter = (next: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };

  const locations = useMemo(() => [...new Set(opportunities.map((o) => o.state))].sort(), [opportunities]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = opportunities.filter((o) => {
      if (tab === "recommended" && (o.matchPercent ?? 0) < RECOMMENDED_MIN_MATCH) return false;
      if (tab === "near" && o.distanceKm > NEAR_ME_KM) return false;
      if (q && ![o.title, o.organisation, ...o.skills].some((t) => t.toLowerCase().includes(q))) return false;
      if (category !== "all" && o.category !== category) return false;
      if (location !== "all" && o.state !== location) return false;
      const daysAway = daysBetween(today, o.start);
      if (date === "week" && daysAway > 7) return false;
      if (date === "month" && daysAway > 31) return false;
      if (filters.categories.length && !filters.categories.includes(o.category)) return false;
      if (filters.skills.length && !filters.skills.some((s) => o.skills.includes(s))) return false;
      if (!matchesAvailability(o, filters.availability)) return false;
      if (o.distanceKm > filters.maxDistance) return false;
      if (filters.languages.length && !filters.languages.some((l) => o.languages.includes(l))) return false;
      return true;
    });

    const byMatch = (a: Opportunity, b: Opportunity) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1);
    const bySoonest = (a: Opportunity, b: Opportunity) => a.start.localeCompare(b.start);
    const byNearest = (a: Opportunity, b: Opportunity) => a.distanceKm - b.distanceKm;
    return list.sort(sort === "soonest" ? bySoonest : sort === "nearest" ? byNearest : byMatch);
  }, [opportunities, today, tab, query, category, location, date, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const goToPage = (p: number) => {
    setPage(p);
    listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasFilters =
    filters.categories.length + filters.skills.length + filters.availability.length + filters.languages.length > 0 ||
    filters.maxDistance !== MAX_DISTANCE;

  return (
    <div>
      {/* Search row */}
      <form
        className="flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(queryInput);
          setPage(1);
        }}
      >
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by project, organisation or skill..."
            aria-label="Search opportunities"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-faint hover:border-ink/30 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 md:flex">
          <Select
            label="Category"
            className="md:w-44"
            value={category}
            onChange={reset(setCategory)}
            options={[{ value: "all", label: "Category: All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
          <Select
            label="Location"
            className="md:w-44"
            value={location}
            onChange={reset(setLocation)}
            options={[{ value: "all", label: "Location: All" }, ...locations.map((l) => ({ value: l, label: l }))]}
          />
          <Select
            label="Date"
            className="md:w-36"
            value={date}
            onChange={reset(setDate)}
            options={[
              { value: "any", label: "Date: Any" },
              { value: "week", label: "Next 7 days" },
              { value: "month", label: "Next 30 days" },
            ]}
          />
        </div>
        <Button type="submit" variant="primary" size="lg">
          Search
        </Button>
      </form>

      <Tabs
        id="browse"
        className="mt-6"
        items={[
          { value: "all", label: "All opportunities" },
          { value: "recommended", label: "Recommended for you (AI)" },
          { value: "near", label: "Near me" },
        ]}
        value={tab}
        onChange={reset(setTab)}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Filters sidebar */}
        <Card className="h-fit space-y-5 p-4 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold">Filters</h2>

          <FilterGroup title="Category">
            {CATEGORIES.map((c) => (
              <Checkbox
                key={c}
                label={c}
                checked={filters.categories.includes(c)}
                onChange={() => setFilter({ categories: toggle(filters.categories, c) })}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Required skills">
            <div className="flex flex-wrap gap-1.5">
              {SKILLS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={filters.skills.includes(s)}
                  onToggle={() => setFilter({ skills: toggle(filters.skills, s) })}
                />
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Availability">
            {AVAILABILITY.map((a) => (
              <Checkbox
                key={a}
                label={a}
                checked={filters.availability.includes(a)}
                onChange={() => setFilter({ availability: toggle(filters.availability, a) })}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Distance from me">
            <input
              type="range"
              min={1}
              max={MAX_DISTANCE}
              value={filters.maxDistance}
              onChange={(e) => setFilter({ maxDistance: Number(e.target.value) })}
              aria-label="Maximum distance in km"
              className="w-full"
            />
            <p className="text-xs text-muted">
              {filters.maxDistance === MAX_DISTANCE ? "Any distance" : `Within ${filters.maxDistance} km`}
            </p>
          </FilterGroup>

          <FilterGroup title="Language">
            {LANGUAGES.map((l) => (
              <Checkbox
                key={l}
                label={l}
                checked={filters.languages.includes(l)}
                onChange={() => setFilter({ languages: toggle(filters.languages, l) })}
              />
            ))}
          </FilterGroup>

          <Button
            variant="outline"
            size="sm"
            disabled={!hasFilters}
            onClick={() => setFilter(emptyFilters)}
          >
            Clear filters
          </Button>
        </Card>

        {/* Results */}
        <div ref={listTop} className="scroll-mt-20">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              Showing {results.length} {results.length === 1 ? "opportunity" : "opportunities"}
            </p>
            <Select
              label="Sort"
              className="w-44"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: "best", label: "Sort: Best match" },
                { value: "soonest", label: "Sort: Soonest" },
                { value: "nearest", label: "Sort: Nearest" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.35 }}
                >
                  <OpportunityCard opportunity={o} />
                </motion.div>
              ))}
            </AnimatePresence>

            {results.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="p-10 text-center">
                  <p className="font-medium">No opportunities match your filters</p>
                  <p className="mt-1 text-sm text-muted">Try removing a filter or searching for something else.</p>
                </Card>
              </motion.div>
            )}
          </div>

          {pageCount > 1 && (
            <nav className="mt-6 flex justify-center gap-1.5" aria-label="Pagination">
              <PageButton label="‹" ariaLabel="Previous page" disabled={current === 1} onClick={() => goToPage(current - 1)} />
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <PageButton key={p} label={String(p)} active={p === current} onClick={() => goToPage(p)} />
              ))}
              <PageButton
                label="›"
                ariaLabel="Next page"
                disabled={current === pageCount}
                onClick={() => goToPage(current + 1)}
              />
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium text-ink">{title}</h3>
      {children}
    </div>
  );
}

function PageButton({
  label,
  ariaLabel,
  active,
  disabled,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "size-8 rounded-md border text-sm hover:-translate-y-px active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40 hover:bg-canvas",
      )}
    >
      {label}
    </button>
  );
}

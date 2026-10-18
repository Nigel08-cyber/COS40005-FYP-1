"use client";

import Link from "next/link";
import { Badge, SkillTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, Placeholder } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import type { Opportunity } from "@/lib/types";
import { PrimaryAction, StatusBadge } from "./OpportunityStatus";
import { useVolunteer } from "./VolunteerProvider";

export function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  const { registeredCount } = useVolunteer();
  const registered = registeredCount(o);

  return (
    <Card interactive className="group flex flex-col gap-4 p-4 sm:flex-row">
      <Link href={`/opportunities/${o.id}`} className="shrink-0 overflow-hidden rounded-lg" tabIndex={-1}>
        <Placeholder
          label="Project image"
          className="h-36 w-full transition-transform duration-500 ease-(--ease-smooth) group-hover:scale-[1.03] sm:h-full sm:min-h-32 sm:w-44"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/opportunities/${o.id}`} className="rounded">
          <h3 className="font-semibold text-ink transition-colors group-hover:text-brand">{o.title}</h3>
        </Link>
        <p className="mt-0.5 text-xs text-muted">{o.organisation}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {formatShortDate(o.start)} · {formatTimeRange(o.start, o.end)} · {o.area} · {o.distanceKm} km
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {o.skills.map((s) => (
            <SkillTag key={s}>{s}</SkillTag>
          ))}
        </div>
        <div className="mt-3 max-w-xs">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-ink">Volunteers</span>
            <span className="text-muted">
              {registered}/{o.volunteersNeeded} volunteers
            </span>
          </div>
          <ProgressBar value={registered} max={o.volunteersNeeded} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:w-44">
        <div className="flex min-h-6 flex-wrap items-center justify-end gap-1.5">
          {o.matchPercent !== undefined && <Badge tone="brand">{o.matchPercent}% match</Badge>}
          <StatusBadge opportunity={o} />
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <PrimaryAction opportunity={o} />
          <Button href={`/opportunities/${o.id}`} variant="outline">
            View details
          </Button>
        </div>
      </div>
    </Card>
  );
}

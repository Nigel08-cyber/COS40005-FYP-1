import { Card } from "@/components/ui/Card";
import { dateBlock } from "@/lib/format";

/** Row with a calendar-style date block, used on My activities and the dashboard. */
export function ActivityRow({
  date,
  title,
  meta,
  badge,
  actions,
}: {
  date: string;
  title: string;
  meta: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const d = dateBlock(date);
  return (
    <Card interactive className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-canvas leading-none">
          <span className="text-[10px] font-medium text-muted">{d.month}</span>
          <span className="mt-1 text-lg font-bold">{d.day}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{meta}</p>
          {badge && <div className="mt-1.5">{badge}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </Card>
  );
}

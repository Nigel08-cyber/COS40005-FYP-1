import { cx } from "@/lib/format";

export type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand border-brand-line",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  neutral: "bg-canvas text-ink-soft border-line",
};

/** Small status pill: AI match, approved, pending, full... */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Outlined skill chip ("Food handling", "Logistics"...). */
export function SkillTag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs",
        tone === "brand" ? "border-brand-line bg-brand-soft text-brand" : "border-line-strong bg-surface text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

import { cx } from "@/lib/format";

export function Card({
  className,
  interactive = false,
  tone = "default",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; tone?: "default" | "brand" }) {
  return (
    <div
      className={cx(
        "rounded-xl border",
        tone === "brand" ? "border-brand-line bg-brand-soft" : "border-line bg-surface",
        interactive &&
          "transition-[box-shadow,transform,border-color] duration-300 ease-(--ease-smooth) hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-ink/5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cx("text-sm font-semibold text-ink", className)}>{children}</h2>;
}

/** Grey wireframe placeholder for images, maps and illustrations. */
export function Placeholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-lg bg-placeholder text-xs text-muted",
        className,
      )}
    >
      {label}
    </div>
  );
}

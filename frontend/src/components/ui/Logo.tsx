import { useId } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";

/** The Tandem mark: two linked rings on the brand tile. Same drawing as app/icon.svg. */
export function TandemMark({ className }: { className?: string }) {
  const clip = `tandem-lens-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clip}>
          <circle cx="25" cy="32" r="14.5" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="15" className="fill-brand" />
      <circle cx="25" cy="32" r="14.5" fill="none" stroke="#fff" strokeWidth="4" />
      <circle cx="39" cy="32" r="14.5" fill="none" stroke="#fff" strokeWidth="4" />
      <circle cx="39" cy="32" r="14.5" fill="#fff" clipPath={`url(#${clip})`} />
    </svg>
  );
}

export function Logo({ href = "/", large = false }: { href?: string; large?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-md">
      <TandemMark
        className={cx(
          "transition-transform duration-300 ease-(--ease-smooth) group-hover:rotate-6 group-hover:scale-105",
          large ? "size-8" : "size-7",
        )}
      />
      <span className={cx("font-semibold tracking-tight text-ink", large ? "text-lg" : "text-sm")}>Tandem</span>
    </Link>
  );
}

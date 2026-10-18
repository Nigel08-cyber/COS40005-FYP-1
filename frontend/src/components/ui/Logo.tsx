import Link from "next/link";
import { cx } from "@/lib/format";

export function Logo({ href = "/", large = false }: { href?: string; large?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-md">
      <span
        className={cx(
          "rounded-md bg-ink transition-transform duration-300 ease-(--ease-smooth) group-hover:rotate-6 group-hover:scale-105",
          large ? "size-7" : "size-6",
        )}
      />
      <span className={cx("font-semibold text-ink", large ? "text-lg" : "text-sm")}>VolunteerHub</span>
    </Link>
  );
}

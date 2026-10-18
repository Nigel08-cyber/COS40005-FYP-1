import Link from "next/link";
import { cx } from "@/lib/format";

type Variant = "primary" | "brand" | "outline" | "ghost" | "danger-outline";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium select-none " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-sm hover:bg-black hover:shadow-md hover:shadow-ink/20",
  brand: "bg-brand text-white shadow-sm hover:bg-brand-hover hover:shadow-md hover:shadow-brand/30",
  outline:
    "border border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-canvas hover:shadow-sm",
  ghost: "text-ink-soft hover:bg-canvas hover:text-ink",
  "danger-outline":
    "border border-line-strong bg-surface text-ink hover:border-danger/50 hover:bg-danger-soft hover:text-danger",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined; loading?: boolean };
type LinkProps = CommonProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function Button({ variant = "outline", size = "md", className, children, ...props }: ButtonProps | LinkProps) {
  const classes = cx(base, variants[variant], sizes[size], className);

  if (props.href !== undefined) {
    const { href, ...rest } = props as Omit<LinkProps, keyof CommonProps>;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { loading, disabled, type, ...rest } = props as Omit<ButtonProps, keyof CommonProps>;
  return (
    <button type={type ?? "button"} className={classes} disabled={disabled || loading} {...rest}>
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}

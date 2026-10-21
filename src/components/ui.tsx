import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const buttonStyles = {
  primary: "bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-brand hover:brightness-110 active:brightness-95",
  secondary: "bg-white text-gray-900 ring-1 ring-inset ring-gray-200 shadow-xs hover:bg-gray-50 hover:ring-gray-300",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50",
  destructive: "bg-red-600 text-white hover:bg-red-500 shadow-sm",
};

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return <button className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export const inputClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 transition-shadow placeholder:text-gray-400 hover:ring-gray-300 focus:ring-2 focus:ring-brand-500 focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl bg-white shadow-card ring-1 ring-gray-200/70", className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const badgeStyles = {
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200/70",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof badgeStyles; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset", badgeStyles[color])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-[13px] font-semibold text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-gray-500">{sub}</div>}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 h-12 w-12 rounded-2xl bg-linear-to-br from-brand-100 to-brand-200 ring-8 ring-brand-50" aria-hidden />
      <div className="text-base font-bold text-gray-900">{title}</div>
      {children && <div className="mt-2 max-w-md text-sm text-gray-500">{children}</div>}
    </Card>
  );
}

export const typeLabels = {
  TOUR: "Product tour",
  CHECKLIST: "Checklist",
  ANNOUNCEMENT: "Announcement",
  HOTSPOT: "Hotspots",
  SURVEY: "Survey",
  RESOURCE_CENTER: "Resource center",
  INLINE: "Inline card",
} as const;

export const statusColors = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "yellow" } as const;

// Icon tile per guide type, used in lists. Strokes are 24px-grid paths.
const typeIcons: Record<keyof typeof typeLabels, { path: string; tile: string }> = {
  TOUR: { path: "M5 4h14v10H9l-4 4z", tile: "bg-brand-50 text-brand-600" },
  CHECKLIST: { path: "m4 12 5 5L20 6", tile: "bg-emerald-50 text-emerald-600" },
  ANNOUNCEMENT: { path: "M3 10v4l11 5V5zM14 8a5 5 0 0 1 0 8", tile: "bg-amber-50 text-amber-600" },
  HOTSPOT: { path: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16", tile: "bg-sky-50 text-sky-600" },
  SURVEY: { path: "M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.5-7 11-7 11z", tile: "bg-rose-50 text-rose-600" },
  RESOURCE_CENTER: { path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01", tile: "bg-violet-50 text-violet-600" },
  INLINE: { path: "M4 5h16M4 19h16M6 9h12v6H6z", tile: "bg-teal-50 text-teal-600" },
};

export function GuideTypeIcon({ type, className }: { type: keyof typeof typeLabels; className?: string }) {
  const t = typeIcons[type];
  return (
    <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.tile, className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={t.path} />
      </svg>
    </span>
  );
}

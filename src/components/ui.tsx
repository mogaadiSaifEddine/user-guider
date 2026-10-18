import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const buttonStyles = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm",
  secondary: "bg-white text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50 shadow-sm",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50",
};

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

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
  "block w-full rounded-md border-0 bg-white px-2.5 py-1.5 text-sm text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none";

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
  return <div className={cx("rounded-xl bg-white shadow-xs ring-1 ring-gray-200", className)} {...props} />;
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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
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
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof badgeStyles; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeStyles[color])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
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
} as const;

export const statusColors = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "yellow" } as const;

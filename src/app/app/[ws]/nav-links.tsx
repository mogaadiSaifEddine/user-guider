"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const links = [
  { href: "", label: "Overview" },
  { href: "/guides", label: "Guides" },
  { href: "/knowledge", label: "Knowledge base" },
  { href: "/analytics", label: "Analytics" },
  { href: "/users", label: "Users" },
  { href: "/companies", label: "Companies" },
  { href: "/install", label: "Install" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks({ ws }: { ws: string }) {
  const pathname = usePathname();
  const base = `/app/${ws}`;
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {links.map((l) => {
        const href = base + l.href;
        const active = l.href ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={l.label}
            href={href}
            className={cx(
              "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap",
              active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

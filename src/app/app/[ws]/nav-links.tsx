"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

// Stroke paths on a 24px grid.
const links = [
  { href: "", label: "Overview", icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/guides", label: "Guides", icon: "M4 5h16M4 12h10M4 19h7M18 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6" },
  { href: "/knowledge", label: "Knowledge base", icon: "M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM8 8h6M8 12h6" },
  { href: "/updates", label: "Product updates", icon: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" },
  { href: "/analytics", label: "Analytics", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/users", label: "Users", icon: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-2.5-4.8" },
  { href: "/companies", label: "Companies", icon: "M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2" },
  { href: "/install", label: "Install", icon: "m8 7-5 5 5 5M16 7l5 5-5 5" },
  { href: "/settings", label: "Settings", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" },
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
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-brand-500/20 text-white shadow-[inset_2px_0_0_var(--color-brand-400)]"
                : "text-gray-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className={cx("h-[18px] w-[18px] shrink-0", active ? "text-brand-300" : "text-gray-500")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={l.icon} />
            </svg>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

type Section = { title: string; pages: { slug: string; title: string }[] };

export function DocsNav({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = pathname.replace(/^\/docs\/?/, "");
  const currentTitle = sections.flatMap((s) => s.pages).find((p) => p.slug === current)?.title ?? "Menu";

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <aside className="border-b border-gray-200 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {currentTitle}
        <span className="text-gray-400">{open ? "▴" : "▾"}</span>
      </button>
      <nav className={cx("space-y-6 px-4 pb-6 md:block md:py-8", open ? "block" : "hidden")}>
        {sections.map((s) => (
          <div key={s.title}>
            <div className="mb-2 px-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">{s.title}</div>
            <ul className="space-y-0.5">
              {s.pages.map((p) => {
                const active = p.slug === current;
                return (
                  <li key={p.slug}>
                    <Link
                      href={`/docs${p.slug ? `/${p.slug}` : ""}`}
                      className={cx(
                        "block rounded-md px-2 py-1.5 text-sm",
                        active ? "bg-indigo-50 font-medium text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      )}
                    >
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

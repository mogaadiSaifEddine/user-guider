"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input, Select, typeLabels } from "@/components/ui";

// Search and type filter for the guides list. Both live in the URL so a reload or a
// shared link keeps them.
export function GuideFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce typing so every keystroke doesn't hit the server.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => apply("q", q.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap gap-2">
      <div className="w-full sm:w-56">
        <Input type="search" placeholder="Search guides" aria-label="Search guides" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="w-full sm:w-44">
        <Select aria-label="Guide type" value={params.get("type") ?? ""} onChange={(e) => apply("type", e.target.value)}>
          <option value="">All types</option>
          {Object.entries(typeLabels).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

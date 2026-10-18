"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

type Option = { value: string; label: string };

// Dropdown filters for the Users list; each change updates the query string.
export function FilterBar({ filters }: { filters: { key: string; label: string; options: Option[] }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next}`);
  }

  const active = filters.some((f) => params.get(f.key));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <Select
          key={f.key}
          aria-label={f.label}
          className="w-auto min-w-36"
          value={params.get(f.key) ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
        >
          <option value="">{`All ${f.label.toLowerCase()}s`}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="(none)">{`No ${f.label.toLowerCase()} / unknown`}</option>
        </Select>
      ))}
      {active && (
        <button
          className="text-sm font-medium text-indigo-600 hover:underline"
          onClick={() => {
            const next = new URLSearchParams(params);
            for (const f of filters) next.delete(f.key);
            next.delete("page");
            router.push(`${pathname}?${next}`);
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

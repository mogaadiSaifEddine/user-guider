import { segments, type Segment, type UserFilters } from "@/lib/audience";

export const FILTER_KEYS = ["company", "browser", "os", "device", "language"] as const;

// Reads the Users page filters from its query string (shared with the CSV export).
export function parseUserFilters(sp: Record<string, string | undefined>): UserFilters {
  const f: UserFilters = {};
  const q = sp.q?.trim();
  if (q) f.q = q;
  if (sp.segment && sp.segment in segments) f.segment = sp.segment as Segment;
  for (const k of FILTER_KEYS) if (sp[k]) f[k] = sp[k];
  return f;
}

export function filtersToQuery(f: UserFilters) {
  return new URLSearchParams(Object.entries(f).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
}

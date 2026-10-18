// Targeting checks shared by the server and the SDK. No zod here: the SDK
// bundles this file and should stay small.

export type UrlRule = { op: "contains" | "equals" | "starts_with" | "regex"; value: string };
export type UserRule = {
  attribute: string;
  op: "equals" | "not_equals" | "contains" | "gt" | "lt" | "exists" | "not_exists";
  value: string;
};


export function matchesUrl(rules: UrlRule[], href: string): boolean {
  if (!rules.length) return true;
  let path = href;
  try {
    path = new URL(href).pathname;
  } catch {
    // keep href
  }
  return rules.some((r) => {
    switch (r.op) {
      case "contains":
        return href.includes(r.value);
      case "equals":
        return stripSlash(path) === stripSlash(r.value);
      case "starts_with":
        return path.startsWith(r.value);
      case "regex":
        try {
          return new RegExp(r.value).test(href);
        } catch {
          return false;
        }
    }
  });
}

function stripSlash(s: string) {
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
}

export function matchesUser(rules: UserRule[], attributes: Record<string, unknown>): boolean {
  return rules.every((r) => {
    const v = attributes[r.attribute];
    const has = v !== undefined && v !== null && v !== "";
    switch (r.op) {
      case "exists":
        return has;
      case "not_exists":
        return !has;
      case "equals":
        return has && String(v) === r.value;
      case "not_equals":
        return !has || String(v) !== r.value;
      case "contains":
        return has && String(v).toLowerCase().includes(r.value.toLowerCase());
      case "gt":
      case "lt": {
        const a = toComparable(v);
        const b = toComparable(r.value);
        if (a === null || b === null) return false;
        return r.op === "gt" ? a > b : a < b;
      }
    }
  });
}

// Numbers compare as numbers, ISO dates as timestamps.
function toComparable(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || v === "") return null;
  const n = Number(v);
  if (!Number.isNaN(n)) return n;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

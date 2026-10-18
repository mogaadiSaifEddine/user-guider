import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Who uses the customer's site: active-user counts, segments, companies and
// browser/device breakdowns. Activity comes from UserActivity (one row per
// user per UTC day the snippet loaded).

const DAY = 86_400_000;

export const segments = {
  all: { label: "All users", hint: "" },
  new: { label: "New", hint: "First seen in the last 7 days" },
  weekly: { label: "Weekly active", hint: "Seen in the last 7 days" },
  monthly: { label: "Monthly active", hint: "Seen in the last 30 days" },
  inactive: { label: "Inactive", hint: "Not seen for 30 days or more" },
} as const;

export type Segment = keyof typeof segments;

export const breakdownFields = {
  company: "Company",
  browser: "Browser",
  os: "Operating system",
  device: "Device",
  language: "Language",
} as const;

export type BreakdownField = keyof typeof breakdownFields;

export type UserFilters = {
  q?: string;
  segment?: Segment;
  company?: string;
  browser?: string;
  os?: string;
  device?: string;
  language?: string;
};

// "(none)" in a filter matches users where the field is unknown.
export const NONE = "(none)";

function ago(days: number) {
  return new Date(Date.now() - days * DAY);
}

function startOfUtcDay(daysAgo = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

export function segmentWhere(segment: Segment | undefined): Prisma.EndUserWhereInput {
  switch (segment) {
    case "new":
      return { firstSeenAt: { gte: ago(7) } };
    case "weekly":
      return { lastSeenAt: { gte: ago(7) } };
    case "monthly":
      return { lastSeenAt: { gte: ago(30) } };
    case "inactive":
      return { lastSeenAt: { lt: ago(30) } };
    default:
      return {};
  }
}

const fieldValue = (v: string | undefined) => (v === undefined ? undefined : v === NONE ? null : v);

export function userWhere(workspaceId: string, f: UserFilters): Prisma.EndUserWhereInput {
  return {
    workspaceId,
    ...segmentWhere(f.segment),
    ...(f.q
      ? { OR: [{ externalId: { contains: f.q } }, { companyName: { contains: f.q } }, { companyId: { contains: f.q } }] }
      : {}),
    ...(f.company !== undefined ? { companyId: fieldValue(f.company) } : {}),
    ...(f.browser !== undefined ? { browser: fieldValue(f.browser) } : {}),
    ...(f.os !== undefined ? { os: fieldValue(f.os) } : {}),
    ...(f.device !== undefined ? { device: fieldValue(f.device) } : {}),
    ...(f.language !== undefined ? { language: fieldValue(f.language) } : {}),
  };
}

export async function endUserList(workspaceId: string, f: UserFilters & { page: number; pageSize: number }) {
  const where = userWhere(workspaceId, f);
  const [total, users] = await Promise.all([
    prisma.endUser.count({ where }),
    prisma.endUser.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { _count: { select: { progress: { where: { status: "COMPLETED" } } } } },
    }),
  ]);
  return { total, users };
}

// Counts for the segment tabs, within the other filters.
export async function segmentCounts(workspaceId: string, f: UserFilters) {
  const entries = await Promise.all(
    (Object.keys(segments) as Segment[]).map(
      async (s) => [s, await prisma.endUser.count({ where: userWhere(workspaceId, { ...f, segment: s }) })] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<Segment, number>;
}

// Distinct values of each breakdown field, for the filter menus.
export async function filterOptions(workspaceId: string) {
  const [companies, ...rest] = await Promise.all([
    prisma.endUser.groupBy({
      by: ["companyId", "companyName"],
      where: { workspaceId, companyId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { companyId: "desc" } },
      take: 500,
    }),
    ...(["browser", "os", "device", "language"] as const).map((field) =>
      prisma.endUser.groupBy({
        by: [field],
        where: { workspaceId, [field]: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { [field]: "desc" } },
        take: 100,
      }),
    ),
  ]);
  const values = (rows: Record<string, unknown>[], field: string) => rows.map((r) => String(r[field]));
  return {
    company: companies.map((c) => ({ id: c.companyId!, name: c.companyName ?? c.companyId! })),
    browser: values(rest[0], "browser"),
    os: values(rest[1], "os"),
    device: values(rest[2], "device"),
    language: values(rest[3], "language"),
  };
}

export type ActivePoint = { date: string; daily: number; weekly: number; monthly: number; new: number };

export async function audienceOverview(workspaceId: string, days = 30) {
  const from = startOfUtcDay(days - 1);
  const to = startOfUtcDay(0);
  const [total, identified, newUsers, weekly, monthly, inactive, today, trend, newPerDay] = await Promise.all([
    prisma.endUser.count({ where: { workspaceId } }),
    prisma.endUser.count({ where: { workspaceId, anonymous: false } }),
    prisma.endUser.count({ where: { workspaceId, firstSeenAt: { gte: from } } }),
    prisma.endUser.count({ where: { workspaceId, ...segmentWhere("weekly") } }),
    prisma.endUser.count({ where: { workspaceId, ...segmentWhere("monthly") } }),
    prisma.endUser.count({ where: { workspaceId, ...segmentWhere("inactive") } }),
    prisma.userActivity.count({ where: { workspaceId, day: to } }),
    // For every day in range: users active that day, in the 7 days and the 30 days ending that day.
    prisma.$queryRaw<{ d: Date | string; dau: bigint; wau: bigint; mau: bigint }[]>`
      WITH RECURSIVE cal (d) AS (
        SELECT CAST(${from} AS DATE)
        UNION ALL SELECT d + INTERVAL 1 DAY FROM cal WHERE d < CAST(${to} AS DATE)
      )
      SELECT cal.d AS d,
        COUNT(DISTINCT CASE WHEN a.day = cal.d THEN a.endUserId END) AS dau,
        COUNT(DISTINCT CASE WHEN a.day > cal.d - INTERVAL 7 DAY THEN a.endUserId END) AS wau,
        COUNT(DISTINCT a.endUserId) AS mau
      FROM cal
      LEFT JOIN UserActivity a
        ON a.workspaceId = ${workspaceId} AND a.day <= cal.d AND a.day > cal.d - INTERVAL 30 DAY
      GROUP BY cal.d
      ORDER BY cal.d`,
    prisma.$queryRaw<{ d: Date | string; c: bigint }[]>`
      SELECT DATE(firstSeenAt) AS d, COUNT(*) AS c
      FROM EndUser
      WHERE workspaceId = ${workspaceId} AND firstSeenAt >= ${from}
      GROUP BY d`,
  ]);

  const key = (d: Date | string) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
  const newByDay = new Map(newPerDay.map((r) => [key(r.d), Number(r.c)]));
  const series: ActivePoint[] = trend.map((r) => ({
    date: key(r.d),
    daily: Number(r.dau),
    weekly: Number(r.wau),
    monthly: Number(r.mau),
    new: newByDay.get(key(r.d)) ?? 0,
  }));
  const last7 = series.slice(-7);
  const avgDaily = last7.length ? last7.reduce((a, p) => a + p.daily, 0) / last7.length : 0;

  return {
    total,
    identified,
    newUsers,
    today,
    weekly,
    monthly,
    inactive,
    // Average daily actives over the last week ÷ monthly actives.
    stickiness: monthly ? Math.round((avgDaily / monthly) * 100) : 0,
    series,
  };
}

// Users active in the range, split by one field. Rows past `limit` fold into "Other".
export async function breakdown(workspaceId: string, field: Exclude<BreakdownField, "company">, days = 30, limit = 6) {
  const rows = await prisma.endUser.groupBy({
    by: [field],
    where: { workspaceId, lastSeenAt: { gte: ago(days) } },
    _count: { _all: true },
  });
  const sorted = rows
    .map((r) => ({ value: (r[field] as string | null) ?? null, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const total = sorted.reduce((a, r) => a + r.count, 0);
  const top = sorted.filter((r) => r.value !== null).slice(0, limit);
  const rest = total - top.reduce((a, r) => a + r.count, 0);
  return {
    total,
    rows: [
      ...top.map((r) => ({ key: r.value!, count: r.count })),
      ...(rest ? [{ key: null as string | null, count: rest }] : []),
    ],
  };
}

export type CompanyRow = {
  companyId: string;
  companyName: string | null;
  users: number;
  newUsers: number;
  weekly: number;
  monthly: number;
  inactive: number;
  lastSeenAt: Date;
  completions: number;
};

export async function companyList(workspaceId: string, opts: { q?: string; limit?: number; sort?: "users" | "active" | "recent" }) {
  const weekAgo = ago(7);
  const monthAgo = ago(30);
  const like = opts.q ? `%${opts.q}%` : null;
  const order =
    opts.sort === "active" ? Prisma.sql`monthly DESC, users DESC` : opts.sort === "recent" ? Prisma.sql`lastSeenAt DESC` : Prisma.sql`users DESC`;
  const rows = await prisma.$queryRaw<
    {
      companyId: string;
      companyName: string | null;
      users: bigint;
      newUsers: bigint;
      weekly: bigint;
      monthly: bigint;
      lastSeenAt: Date;
      completions: bigint;
    }[]
  >`
    SELECT u.companyId, MAX(u.companyName) AS companyName,
      COUNT(*) AS users,
      SUM(u.firstSeenAt >= ${weekAgo}) AS newUsers,
      SUM(u.lastSeenAt >= ${weekAgo}) AS weekly,
      SUM(u.lastSeenAt >= ${monthAgo}) AS monthly,
      MAX(u.lastSeenAt) AS lastSeenAt,
      COALESCE(SUM(p.c), 0) AS completions
    FROM EndUser u
    LEFT JOIN (
      SELECT endUserId, COUNT(*) AS c FROM GuideProgress WHERE status = 'COMPLETED' GROUP BY endUserId
    ) p ON p.endUserId = u.id
    WHERE u.workspaceId = ${workspaceId} AND u.companyId IS NOT NULL
      ${like ? Prisma.sql`AND (u.companyId LIKE ${like} OR u.companyName LIKE ${like})` : Prisma.empty}
    GROUP BY u.companyId
    ORDER BY ${order}
    LIMIT ${opts.limit ?? 200}`;
  const [count, withoutCompany] = await Promise.all([
    prisma.endUser.findMany({ where: { workspaceId, companyId: { not: null } }, distinct: ["companyId"], select: { companyId: true } }),
    prisma.endUser.count({ where: { workspaceId, companyId: null } }),
  ]);
  return {
    totalCompanies: count.length,
    withoutCompany,
    rows: rows.map(
      (r): CompanyRow => ({
        companyId: r.companyId,
        companyName: r.companyName,
        users: Number(r.users),
        newUsers: Number(r.newUsers),
        weekly: Number(r.weekly),
        monthly: Number(r.monthly),
        inactive: Number(r.users) - Number(r.monthly),
        lastSeenAt: new Date(r.lastSeenAt),
        completions: Number(r.completions),
      }),
    ),
  };
}

// Readable names for BCP 47 tags, e.g. "en-US" → "English (United States)".
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export function languageLabel(tag: string) {
  try {
    return languageNames.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

export function fieldLabel(field: BreakdownField, value: string | null) {
  if (value === null) return "Unknown";
  if (field === "language") return languageLabel(value);
  if (field === "device") return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

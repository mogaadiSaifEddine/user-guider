import "server-only";
import { prisma } from "./db";

// Counts are distinct end users, not raw events, so a user who sees a tour on
// five page loads counts once.

export type DailyPoint = { date: string; seen: number; completed: number };

function since(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

function dayKeys(days: number) {
  const start = since(days);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

type DailyRow = { d: Date | string; type: string; c: bigint };

function toSeries(rows: DailyRow[], days: number): DailyPoint[] {
  const map = new Map(dayKeys(days).map((k) => [k, { date: k, seen: 0, completed: 0 }]));
  for (const r of rows) {
    const key = (r.d instanceof Date ? r.d.toISOString() : String(r.d)).slice(0, 10);
    const p = map.get(key);
    if (!p) continue;
    if (r.type === "guide_shown") p.seen = Number(r.c);
    if (r.type === "guide_completed") p.completed = Number(r.c);
  }
  return [...map.values()];
}

export async function workspaceOverview(workspaceId: string, days = 30) {
  const from = since(days);
  const [activeUsers, identifiedUsers, totalUsers, publishedGuides, perGuide, daily] = await Promise.all([
    prisma.endUser.count({ where: { workspaceId, lastSeenAt: { gte: from } } }),
    prisma.endUser.count({ where: { workspaceId, lastSeenAt: { gte: from }, anonymous: false } }),
    prisma.endUser.count({ where: { workspaceId } }),
    prisma.guide.count({ where: { workspaceId, status: "PUBLISHED" } }),
    prisma.$queryRaw<{ guideId: string; type: string; c: bigint }[]>`
      SELECT "guideId", type, COUNT(DISTINCT "endUserId") AS c
      FROM "Event"
      WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${from} AND "guideId" IS NOT NULL
        AND type IN ('guide_shown', 'guide_completed', 'guide_dismissed')
      GROUP BY "guideId", type`,
    prisma.$queryRaw<DailyRow[]>`
      SELECT "createdAt"::date AS d, type, COUNT(DISTINCT "endUserId") AS c
      FROM "Event"
      WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${from}
        AND type IN ('guide_shown', 'guide_completed')
      GROUP BY d, type`,
  ]);

  const guides = await prisma.guide.findMany({
    where: { workspaceId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
  const stats = new Map<string, { seen: number; completed: number; dismissed: number }>();
  for (const r of perGuide) {
    const s = stats.get(r.guideId) ?? { seen: 0, completed: 0, dismissed: 0 };
    if (r.type === "guide_shown") s.seen = Number(r.c);
    if (r.type === "guide_completed") s.completed = Number(r.c);
    if (r.type === "guide_dismissed") s.dismissed = Number(r.c);
    stats.set(r.guideId, s);
  }

  return {
    activeUsers,
    identifiedUsers,
    totalUsers,
    publishedGuides,
    daily: toSeries(daily, days),
    guides: guides.map((g) => ({ ...g, ...(stats.get(g.id) ?? { seen: 0, completed: 0, dismissed: 0 }) })),
  };
}

export async function guideAnalytics(guideId: string, days = 30) {
  const from = since(days);
  const [totals, steps, items, daily] = await Promise.all([
    prisma.$queryRaw<{ type: string; c: bigint }[]>`
      SELECT type, COUNT(DISTINCT "endUserId") AS c
      FROM "Event"
      WHERE "guideId" = ${guideId} AND "createdAt" >= ${from}
      GROUP BY type`,
    prisma.$queryRaw<{ stepIndex: number; c: bigint }[]>`
      SELECT "stepIndex", COUNT(DISTINCT "endUserId") AS c
      FROM "Event"
      WHERE "guideId" = ${guideId} AND "createdAt" >= ${from} AND type = 'step_viewed'
      GROUP BY "stepIndex"`,
    // Checklist items, hotspots and resource center items all carry their id in `name`.
    prisma.$queryRaw<{ name: string; c: bigint }[]>`
      SELECT name, COUNT(DISTINCT "endUserId") AS c
      FROM "Event"
      WHERE "guideId" = ${guideId} AND "createdAt" >= ${from}
        AND type IN ('checklist_item_completed', 'hotspot_opened', 'resource_clicked') AND name IS NOT NULL
      GROUP BY name`,
    prisma.$queryRaw<DailyRow[]>`
      SELECT "createdAt"::date AS d, type, COUNT(DISTINCT "endUserId") AS c
      FROM "Event"
      WHERE "guideId" = ${guideId} AND "createdAt" >= ${from}
        AND type IN ('guide_shown', 'guide_completed')
      GROUP BY d, type`,
  ]);

  const t = Object.fromEntries(totals.map((r) => [r.type, Number(r.c)]));
  return {
    seen: t.guide_shown ?? 0,
    completed: t.guide_completed ?? 0,
    dismissed: t.guide_dismissed ?? 0,
    clicked: t.resource_clicked ?? 0,
    steps: new Map(steps.map((r) => [Number(r.stepIndex), Number(r.c)])),
    items: new Map(items.map((r) => [r.name, Number(r.c)])),
    daily: toSeries(daily, days),
  };
}

export function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

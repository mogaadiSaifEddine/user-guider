import Link from "next/link";
import type { GuideStatus, GuideType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { guideStats, pct } from "@/lib/analytics";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, cx, statusColors, typeLabels } from "@/components/ui";
import { NewGuideButton } from "./new-guide";
import { GuideFilters } from "./guide-filters";

const tabs: { key: GuideStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Active" },
  { key: "PUBLISHED", label: "Live" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ARCHIVED", label: "Archived" },
];

export default async function GuidesPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ status?: string; q?: string; type?: string }>;
}) {
  const { ws } = await params;
  const { status = "ALL", q = "", type = "" } = await searchParams;
  await requireWorkspace(ws);

  const search = q.trim();
  const typeFilter = type in typeLabels ? (type as GuideType) : undefined;
  const [guides, stats] = await Promise.all([
    prisma.guide.findMany({
      where: {
        workspaceId: ws,
        status: status === "ALL" ? { not: "ARCHIVED" } : (status as GuideStatus),
        ...(search && {
          name: { contains: search, mode: "insensitive" as const },
        }),
        ...(typeFilter && { type: typeFilter }),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        updatedAt: true,
        priority: true,
      },
    }),
    guideStats(ws, 30),
  ]);
  const filtered = Boolean(search || typeFilter);
  const keep = new URLSearchParams({
    ...(search && { q: search }),
    ...(typeFilter && { type: typeFilter }),
  });

  return (
    <>
      <PageHeader
        title="Guides"
        description="Tours, checklists, announcements, hotspots, surveys and resource centers shown on your site."
        actions={
          <>
            <ButtonLink variant="secondary" href={`/app/${ws}/import`}>
              Import from UserGuiding
            </ButtonLink>
            <NewGuideButton ws={ws} />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={tabHref(ws, t.key, keep)}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                status === t.key ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200" : "text-gray-600 hover:text-gray-900",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <GuideFilters />
      </div>

      {guides.length === 0 ? (
        filtered ? (
          <EmptyState title="No matching guides">Try another name or type, or look in the other tabs.</EmptyState>
        ) : (
          <EmptyState title={status === "ALL" ? "No guides yet" : "Nothing here"}>
            {status === "ALL" && "Create a product tour to walk new users through your app."}
          </EmptyState>
        )
      ) : (
        <Card className="divide-y divide-gray-100">
          {guides.map((g) => (
            <Link
              key={g.id}
              href={`/app/${ws}/guides/${g.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{g.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge color="indigo">{typeLabels[g.type]}</Badge>
                  <Badge color={statusColors[g.status]}>{g.status === "PUBLISHED" ? "live" : g.status.toLowerCase()}</Badge>
                  {g.priority !== 0 && <Badge>priority {g.priority}</Badge>}
                </div>
              </div>
              <GuideNumbers
                type={g.type}
                live={g.status === "PUBLISHED"}
                seen={stats.get(g.id)?.seen ?? 0}
                completed={stats.get(g.id)?.completed ?? 0}
              />
              <div className="w-28 text-right text-xs text-gray-500" title={g.updatedAt.toLocaleString()}>
                Edited {timeAgo(g.updatedAt)}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

function tabHref(ws: string, status: string, keep: URLSearchParams) {
  const p = new URLSearchParams(keep);
  if (status !== "ALL") p.set("status", status);
  const qs = p.toString();
  return `/app/${ws}/guides${qs ? `?${qs}` : ""}`;
}

// Last-30-day reach. Hotspots and resource centers have no "completed" state.
function GuideNumbers({ type, live, seen, completed }: { type: GuideType; live: boolean; seen: number; completed: number }) {
  if (!seen) return <div className="w-36 text-right text-xs text-gray-400">{live ? "No views in 30 days" : ""}</div>;
  const completes = type !== "HOTSPOT" && type !== "RESOURCE_CENTER";
  return (
    <div className="w-36 text-right text-xs text-gray-500 tabular-nums" title="Distinct users, last 30 days">
      <span className="font-medium text-gray-900">{seen.toLocaleString()}</span> saw
      {completes && (
        <>
          {" · "}
          <span className="font-medium text-gray-900">{pct(completed, seen)}%</span> done
        </>
      )}
    </div>
  );
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function timeAgo(d: Date) {
  const secs = (d.getTime() - Date.now()) / 1000;
  for (const [unit, size] of units) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return "just now";
}

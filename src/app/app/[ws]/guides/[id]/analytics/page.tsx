import Link from "next/link";
import { requireGuide } from "@/lib/auth";
import { guideAnalytics, pct } from "@/lib/analytics";
import {
  parseContent,
  type ChecklistContent,
  type GuideTypeName,
  type HotspotContent,
  type TourContent,
} from "@/lib/guide-schema";
import { FunnelBars, TrendChart } from "@/components/charts";
import { Badge, ButtonLink, Card, PageHeader, Stat, cx, typeLabels } from "@/components/ui";

const RANGES = [7, 30, 90];

export default async function GuideAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string; id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { ws, id } = await params;
  const days = RANGES.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const { guide } = await requireGuide(ws, id);
  const a = await guideAnalytics(id, days);
  const type = guide.type as GuideTypeName;
  // Label steps/items from the live version when there is one.
  const content = parseContent(type, guide.publishedContent ?? guide.content);

  let breakdown: { title: string; note: string; rows: { label: string; value: number }[] } | null = null;
  if (type === "TOUR") {
    breakdown = {
      title: "Step funnel",
      note: "Users who reached each step. A big drop shows where people leave the tour.",
      rows: (content as TourContent).steps.map((s, i) => ({ label: s.title || `Step ${i + 1}`, value: a.steps.get(i) ?? 0 })),
    };
  } else if (type === "CHECKLIST") {
    breakdown = {
      title: "Items completed",
      note: "Users who completed each item, out of users who saw the checklist.",
      rows: (content as ChecklistContent).items.map((it) => ({ label: it.title || "Untitled", value: a.items.get(it.id) ?? 0 })),
    };
  } else if (type === "HOTSPOT") {
    breakdown = {
      title: "Hotspots opened",
      note: "Users who opened each hotspot.",
      rows: (content as HotspotContent).hotspots.map((h) => ({ label: h.title || "Untitled", value: a.items.get(h.id) ?? 0 })),
    };
  }

  return (
    <>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/guides/${id}`} className="text-gray-500 hover:text-gray-800">
          ← Back to editor
        </Link>
      </div>
      <PageHeader
        title={guide.name}
        description={
          <span className="flex items-center gap-2">
            <Badge color="indigo">{typeLabels[type]}</Badge> Last {days} days
          </span>
        }
        actions={
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-gray-200">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`?days=${r}`}
                className={cx("rounded-md px-3 py-1 text-sm font-medium", r === days ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:text-gray-900")}
              >
                {r}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saw it" value={a.seen} sub="unique users" />
        <Stat label="Completed" value={a.completed} sub={`${pct(a.completed, a.seen)}% of viewers`} />
        <Stat label="Dismissed" value={a.dismissed} sub={`${pct(a.dismissed, a.seen)}% of viewers`} />
        <Stat label="Completion rate" value={`${pct(a.completed, a.seen)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <TrendChart data={a.daily} title="Daily users" />
        </Card>
        {breakdown && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">{breakdown.title}</h2>
            <p className="mb-4 text-xs text-gray-500">{breakdown.note}</p>
            {breakdown.rows.length ? (
              <FunnelBars rows={breakdown.rows} base={type === "TOUR" ? (breakdown.rows[0]?.value ?? 0) : a.seen} />
            ) : (
              <p className="text-sm text-gray-500">Nothing to show yet.</p>
            )}
          </Card>
        )}
      </div>

      {a.seen === 0 && (
        <Card className="mt-6 p-5 text-sm text-gray-600">
          No one has seen this guide in this period.{" "}
          {guide.status !== "PUBLISHED" ? "It isn't published yet." : "Check its page and user targeting."}{" "}
          <ButtonLink variant="ghost" href={`/app/${ws}/guides/${id}`}>
            Open editor
          </ButtonLink>
        </Card>
      )}
    </>
  );
}

import Link from "next/link";
import { requireGuide } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plainText } from "@/lib/format";
import { guideAnalytics, pct } from "@/lib/analytics";
import {
  blocksLabel,
  parseContent,
  type ChecklistContent,
  type GuideTypeName,
  type HotspotContent,
  type ResourceCenterContent,
  type SurveyContent,
  type TourContent,
} from "@/lib/guide-schema";
import { surveyResults } from "@/lib/survey-results";
import { SurveyResults } from "./survey-results";
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
  const survey = type === "SURVEY" ? await surveyResults(id, content as SurveyContent, days) : null;

  let breakdown: { title: string; note: string; rows: { label: string; value: number }[] } | null = null;
  if (type === "TOUR") {
    breakdown = {
      title: "Step funnel",
      note: "Users who reached each step. A big drop shows where people leave the tour.",
      rows: (content as TourContent).steps.map((s, i) => ({ label: blocksLabel(s.blocks) || `Step ${i + 1}`, value: a.steps.get(i) ?? 0 })),
    };
  } else if (type === "CHECKLIST") {
    breakdown = {
      title: "Items completed",
      note: "Users who completed each item, out of users who saw the checklist.",
      rows: (content as ChecklistContent).items.map((it) => ({ label: plainText(it.title) || "Untitled", value: a.items.get(it.id) ?? 0 })),
    };
  } else if (type === "SURVEY") {
    breakdown = {
      title: "Question funnel",
      note: "Users who reached each question. A big drop shows where people stop answering.",
      rows: (content as SurveyContent).questions.map((q, i) => ({ label: plainText(q.title) || `Question ${i + 1}`, value: a.steps.get(i) ?? 0 })),
    };
  } else if (type === "RESOURCE_CENTER") {
    const rc = content as ResourceCenterContent;
    const names = new Map(
      (await prisma.guide.findMany({ where: { workspaceId: ws }, select: { id: true, name: true } })).map((g) => [g.id, g.name]),
    );
    const rows = rc.modules.flatMap((m) => {
      switch (m.type) {
        case "guides":
          return m.items.map((it) => ({ label: `▶ ${plainText(it.label) || names.get(it.guideId) || "Guide"}`, id: it.id }));
        case "articles":
          return m.articles.map((a) => ({ label: `≡ ${plainText(a.title) || "Untitled article"}`, id: a.id }));
        case "links":
          return m.links.map((l) => ({ label: `↗ ${plainText(l.label) || l.url}`, id: l.id }));
        case "contact":
          return [{ label: `✉ ${m.buttonLabel}`, id: m.id }];
        case "checklist":
          return [];
      }
    });
    breakdown = {
      title: "Most used",
      note: "Users who clicked each guide, article, link or contact button, out of users who opened the panel.",
      rows: rows.map((r) => ({ label: r.label, value: a.items.get(r.id) ?? 0 })).sort((x, y) => y.value - x.value),
    };
  } else if (type === "HOTSPOT") {
    breakdown = {
      title: "Hotspots opened",
      note: "Users who opened each hotspot.",
      rows: (content as HotspotContent).hotspots.map((h) => ({ label: plainText(h.title) || "Untitled", value: a.items.get(h.id) ?? 0 })),
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

      {type === "RESOURCE_CENTER" ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Opened it" value={a.seen} sub="unique users" />
          <Stat label="Clicked something" value={a.clicked} sub={`${pct(a.clicked, a.seen)}% of openers`} />
        </div>
      ) : (
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saw it" value={a.seen} sub="unique users" />
        <Stat label="Completed" value={a.completed} sub={`${pct(a.completed, a.seen)}% of viewers`} />
        <Stat label="Dismissed" value={a.dismissed} sub={`${pct(a.dismissed, a.seen)}% of viewers`} />
        <Stat label="Completion rate" value={`${pct(a.completed, a.seen)}%`} />
      </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <TrendChart data={a.daily} title="Daily users" />
        </Card>
        {breakdown && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">{breakdown.title}</h2>
            <p className="mb-4 text-xs text-gray-500">{breakdown.note}</p>
            {breakdown.rows.length ? (
              <FunnelBars rows={breakdown.rows} base={type === "TOUR" || type === "SURVEY" ? (breakdown.rows[0]?.value ?? 0) : a.seen} />
            ) : (
              <p className="text-sm text-gray-500">Nothing to show yet.</p>
            )}
          </Card>
        )}
      </div>

      {survey && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Responses</h2>
              <p className="text-sm text-gray-500">
                {survey.respondents} {survey.respondents === 1 ? "person" : "people"} answered in the last {days} days. Each person&apos;s latest
                answer counts.
              </p>
            </div>
            <a
              href={`/app/${ws}/guides/${id}/responses`}
              className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Export CSV
            </a>
          </div>
          <SurveyResults ws={ws} results={survey.results} />
        </div>
      )}

      {a.seen === 0 && (
        <Card className="mt-6 p-5 text-sm text-gray-600">
          {type === "RESOURCE_CENTER" ? "No one has opened this resource center in this period." : "No one has seen this guide in this period."}{" "}
          {guide.status !== "PUBLISHED" ? "It isn't published yet." : "Check its page and user targeting."}{" "}
          <ButtonLink variant="ghost" href={`/app/${ws}/guides/${id}`}>
            Open editor
          </ButtonLink>
        </Card>
      )}
    </>
  );
}

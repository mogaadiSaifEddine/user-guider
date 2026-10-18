import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { fieldLabel } from "@/lib/audience";
import { parseContent, type SurveyContent } from "@/lib/guide-schema";
import { Badge, Card, PageHeader } from "@/components/ui";

const eventLabels: Record<string, string> = {
  guide_shown: "Saw",
  step_viewed: "Viewed step",
  guide_completed: "Completed",
  guide_dismissed: "Dismissed",
  checklist_item_completed: "Checked item",
  hotspot_opened: "Opened hotspot",
  survey_answered: "Answered",
  resource_clicked: "Opened resource",
  custom: "Event",
};

const statusColor = { STARTED: "indigo", COMPLETED: "green", DISMISSED: "yellow" } as const;

export default async function EndUserPage({ params }: { params: Promise<{ ws: string; userId: string }> }) {
  const { ws, userId } = await params;
  await requireWorkspace(ws);
  const user = await prisma.endUser.findFirst({
    where: { id: userId, workspaceId: ws },
    include: {
      progress: { include: { guide: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 100, include: { guide: { select: { name: true } } } },
      surveyAnswers: {
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { guide: { select: { id: true, name: true, publishedContent: true, content: true } } },
      },
    },
  });
  if (!user) notFound();
  const activeDays = await prisma.userActivity.count({
    where: { endUserId: user.id, day: { gte: new Date(Date.now() - 30 * 86_400_000) } },
  });
  const details: [string, string | null][] = [
    ["Company", user.companyName ?? user.companyId],
    ["Browser", user.browser],
    ["Operating system", user.os],
    ["Device", user.device && fieldLabel("device", user.device)],
    ["Language", user.language && `${fieldLabel("language", user.language)} (${user.language})`],
    ["Time zone", user.timezone],
    ["Active days (30d)", String(activeDays)],
  ];
  const attrs = Object.entries(user.attributes as Record<string, unknown>);

  return (
    <>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/users`} className="text-gray-500 hover:text-gray-800">
          ← Users
        </Link>
      </div>
      <PageHeader
        title={user.anonymous ? "Anonymous visitor" : user.externalId}
        description={`First seen ${user.firstSeenAt.toLocaleString()} · last seen ${user.lastSeenAt.toLocaleString()}`}
      />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="space-y-2 text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="truncate text-right">
                    {k === "Company" && user.companyId ? (
                      <Link href={`/app/${ws}/users?company=${encodeURIComponent(user.companyId)}`} className="hover:text-indigo-600">
                        {v}
                      </Link>
                    ) : (
                      (v ?? <span className="text-gray-400">Unknown</span>)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Attributes</h2>
            {attrs.length ? (
              <dl className="space-y-2 text-sm">
                {attrs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="font-mono text-xs text-gray-500">{k}</dt>
                    <dd className="truncate text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">None sent.</p>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Guides</h2>
            {user.progress.length ? (
              <ul className="space-y-2 text-sm">
                {user.progress.map((p) => (
                  <li key={p.guideId} className="flex items-center justify-between gap-2">
                    <Link href={`/app/${ws}/guides/${p.guide.id}`} className="truncate hover:text-indigo-600">
                      {p.guide.name}
                    </Link>
                    <Badge color={statusColor[p.status]}>{p.status.toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No guides yet.</p>
            )}
          </Card>
        </div>
        <div className="min-w-0 space-y-6">
        {user.surveyAnswers.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Survey answers</h2>
            <ul className="space-y-3 text-sm">
              {user.surveyAnswers.map((a) => {
                const content = parseContent("SURVEY", a.guide.publishedContent ?? a.guide.content) as SurveyContent;
                const q = content.questions.find((x) => x.id === a.questionId);
                const ids = Array.isArray(a.value) ? a.value : [a.value];
                const text = ids
                  .map((v) => (typeof v === "string" ? (q?.options.find((o) => o.id === v)?.label ?? v) : String(v)))
                  .join(", ");
                return (
                  <li key={a.id.toString()}>
                    <div className="text-xs text-gray-500">
                      <Link href={`/app/${ws}/guides/${a.guide.id}/analytics`} className="hover:text-indigo-600">
                        {a.guide.name}
                      </Link>{" "}
                      · {a.updatedAt.toLocaleString()}
                    </div>
                    <div className="text-gray-600">{q?.title || "Removed question"}</div>
                    <div className="font-medium whitespace-pre-wrap">{text}</div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
          {user.events.length ? (
            <ol className="space-y-2.5 text-sm">
              {user.events.map((e) => (
                <li key={e.id.toString()} className="flex gap-3">
                  <span className="w-36 shrink-0 text-xs text-gray-500 tabular-nums">{e.createdAt.toLocaleString()}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{eventLabels[e.type] ?? e.type}</span>{" "}
                    {e.type === "custom" ? (
                      <code className="rounded bg-gray-100 px-1 text-xs">{e.name}</code>
                    ) : (
                      <span className="text-gray-600">
                        {e.guide?.name}
                        {e.stepIndex !== null && e.type === "step_viewed" ? ` · step ${e.stepIndex + 1}` : ""}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">No events.</p>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}

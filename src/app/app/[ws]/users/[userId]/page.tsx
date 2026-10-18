import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";

const eventLabels: Record<string, string> = {
  guide_shown: "Saw",
  step_viewed: "Viewed step",
  guide_completed: "Completed",
  guide_dismissed: "Dismissed",
  checklist_item_completed: "Checked item",
  hotspot_opened: "Opened hotspot",
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
    },
  });
  if (!user) notFound();
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
    </>
  );
}

import Link from "next/link";
import type { GuideStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, cx, statusColors, typeLabels } from "@/components/ui";
import { NewGuideButton } from "./new-guide";

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
  searchParams: Promise<{ status?: string }>;
}) {
  const { ws } = await params;
  const { status = "ALL" } = await searchParams;
  await requireWorkspace(ws);

  const guides = await prisma.guide.findMany({
    where: {
      workspaceId: ws,
      status: status === "ALL" ? { not: "ARCHIVED" } : (status as GuideStatus),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, type: true, status: true, updatedAt: true, priority: true },
  });

  return (
    <>
      <PageHeader
        title="Guides"
        description="Tours, checklists, announcements and hotspots shown on your site."
        actions={<NewGuideButton ws={ws} />}
      />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/app/${ws}/guides${t.key === "ALL" ? "" : `?status=${t.key}`}`}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              status === t.key ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200" : "text-gray-600 hover:text-gray-900",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {guides.length === 0 ? (
        <EmptyState title={status === "ALL" ? "No guides yet" : "Nothing here"}>
          {status === "ALL" && "Create a product tour to walk new users through your app."}
        </EmptyState>
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
              <div className="text-xs text-gray-500">Edited {g.updatedAt.toLocaleDateString()}</div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

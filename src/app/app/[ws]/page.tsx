import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { pct, workspaceOverview } from "@/lib/analytics";
import { TrendChart } from "@/components/charts";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat, statusColors, typeLabels } from "@/components/ui";

export default async function OverviewPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace } = await requireWorkspace(ws);
  const o = await workspaceOverview(ws, 30);

  if (o.totalUsers === 0) {
    return (
      <>
        <PageHeader title="Overview" description={workspace.name} />
        <EmptyState title="No visitors yet">
          Add the snippet to your site and identify your users. Visitors show up here as soon as the script loads.
          <div className="mt-4">
            <ButtonLink href={`/app/${ws}/install`}>Install the snippet</ButtonLink>
          </div>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Overview" description="Last 30 days" actions={<ButtonLink href={`/app/${ws}/guides`}>Guides</ButtonLink>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active users" value={o.activeUsers} sub={`${o.identifiedUsers} identified`} />
        <Stat label="All-time users" value={o.totalUsers} />
        <Stat label="Live guides" value={o.publishedGuides} />
        <Stat
          label="Completion rate"
          value={`${pct(
            o.guides.reduce((a, g) => a + g.completed, 0),
            o.guides.reduce((a, g) => a + g.seen, 0),
          )}%`}
          sub="completed ÷ saw, all guides"
        />
      </div>

      <Card className="mb-6 p-5">
        <TrendChart data={o.daily} title="Daily guide reach" />
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Guide</th>
              <th className="px-3 py-3 text-right font-medium">Saw</th>
              <th className="px-3 py-3 text-right font-medium">Completed</th>
              <th className="px-3 py-3 text-right font-medium">Dismissed</th>
              <th className="px-5 py-3 text-right font-medium">Completion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {o.guides.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <Link href={`/app/${ws}/guides/${g.id}/analytics`} className="font-medium hover:text-indigo-600">
                    {g.name}
                  </Link>
                  <div className="mt-0.5 flex gap-1.5">
                    <Badge>{typeLabels[g.type]}</Badge>
                    <Badge color={statusColors[g.status]}>{g.status.toLowerCase()}</Badge>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{g.seen}</td>
                <td className="px-3 py-3 text-right tabular-nums">{g.completed}</td>
                <td className="px-3 py-3 text-right tabular-nums">{g.dismissed}</td>
                <td className="px-5 py-3 text-right tabular-nums">{pct(g.completed, g.seen)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

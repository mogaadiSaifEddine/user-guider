import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { audienceOverview, breakdown, breakdownFields, companyList, fieldLabel, NONE, type BreakdownField } from "@/lib/audience";
import { CATEGORICAL, ShareBars, TrendChart } from "@/components/charts";
import { ButtonLink, Card, EmptyState, PageHeader, Stat, cx } from "@/components/ui";

const RANGES = [7, 30, 90];
const FIELDS = ["browser", "os", "device", "language"] as const;

const ACTIVE_SERIES = [
  { key: "daily", label: "Daily active", color: CATEGORICAL[0] },
  { key: "weekly", label: "Weekly active", color: CATEGORICAL[1] },
  { key: "monthly", label: "Monthly active", color: CATEGORICAL[2] },
];
const NEW_SERIES = [{ key: "new", label: "New users", color: CATEGORICAL[0] }];

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { ws } = await params;
  const requested = Number((await searchParams).days);
  const days = RANGES.includes(requested) ? requested : 30;
  await requireWorkspace(ws);

  const [o, companies, ...splits] = await Promise.all([
    audienceOverview(ws, days),
    companyList(ws, { limit: 8, sort: "active" }),
    ...FIELDS.map((f) => breakdown(ws, f, days)),
  ]);
  const users = (q: Record<string, string>) => `/app/${ws}/users?${new URLSearchParams(q)}`;

  if (o.total === 0) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState title="No visitors yet">
          Install the snippet and identify your users. Their activity, devices and companies show up here.
          <div className="mt-4">
            <ButtonLink href={`/app/${ws}/install`}>Install the snippet</ButtonLink>
          </div>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Who uses your site · last ${days} days`}
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

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatLink href={users({})} label="All users" value={o.total} sub={`${o.identified} identified`} />
        <StatLink href={users({ segment: "new" })} label={`New (${days}d)`} value={o.newUsers} sub="first seen in range" />
        <Stat label="Active today" value={o.today} sub="UTC day" />
        <StatLink href={users({ segment: "weekly" })} label="Weekly active" value={o.weekly} sub="seen in 7 days" />
        <StatLink href={users({ segment: "monthly" })} label="Monthly active" value={o.monthly} sub={`stickiness ${o.stickiness}%`} />
        <StatLink href={users({ segment: "inactive" })} label="Inactive" value={o.inactive} sub="not seen for 30+ days" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <TrendChart
            data={o.series}
            title="Active users"
            series={ACTIVE_SERIES}
            description="users active that day, in the 7 days and in the 30 days up to it"
          />
          <p className="mt-2 text-xs text-gray-500">
            Each point counts users who loaded a page with the snippet that day (daily), in the 7 days up to it (weekly) or in the 30 days up to it
            (monthly). Stickiness = average daily actives over the last week ÷ monthly actives.
          </p>
        </Card>
        <Card className="p-5">
          <TrendChart data={o.series} title="New users per day" series={NEW_SERIES} description="users seen for the first time each day" />
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {FIELDS.map((field, i) => (
          <BreakdownCard key={field} ws={ws} field={field} data={splits[i]} />
        ))}
      </div>

      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Most active companies</h2>
            <p className="text-xs text-gray-500">
              {companies.totalCompanies} companies · {companies.withoutCompany} users without one
            </p>
          </div>
          <ButtonLink variant="ghost" href={`/app/${ws}/companies`}>
            All companies →
          </ButtonLink>
        </div>
        {companies.rows.length ? (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-5 py-2 font-medium">Company</th>
                <th className="px-3 py-2 text-right font-medium">Users</th>
                <th className="px-3 py-2 text-right font-medium">Weekly active</th>
                <th className="px-3 py-2 text-right font-medium">Monthly active</th>
                <th className="px-5 py-2 text-right font-medium">Inactive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.rows.map((c) => (
                <tr key={c.companyId} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5">
                    <Link href={users({ company: c.companyId })} className="font-medium hover:text-indigo-600">
                      {c.companyName ?? c.companyId}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.users}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.weekly}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.monthly}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{c.inactive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 pb-5 text-sm text-gray-500">
            No companies yet. Send a company attribute with <code>identify()</code>, or choose which attributes hold it in{" "}
            <Link href={`/app/${ws}/settings`} className="font-medium text-indigo-600 hover:underline">
              Settings
            </Link>
            .
          </p>
        )}
      </Card>
    </>
  );
}

function StatLink({ href, ...props }: { href: string; label: string; value: number; sub?: string }) {
  return (
    <Link href={href} className="block rounded-xl transition hover:ring-2 hover:ring-indigo-200">
      <Stat {...props} />
    </Link>
  );
}

function BreakdownCard({
  ws,
  field,
  data,
}: {
  ws: string;
  field: Exclude<BreakdownField, "company">;
  data: { total: number; rows: { key: string | null; count: number }[] };
}) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-900">{breakdownFields[field]}</h2>
      <p className="mb-4 text-xs text-gray-500">Active users in range</p>
      {data.total ? (
        <ShareBars
          total={data.total}
          rows={data.rows.map((r) => ({
            label: r.key === null ? (data.rows.length > 1 ? "Other / unknown" : "Unknown") : fieldLabel(field, r.key),
            value: r.count,
            href: r.key === null ? undefined : `/app/${ws}/users?${new URLSearchParams({ [field]: r.key ?? NONE })}`,
          }))}
        />
      ) : (
        <p className="text-sm text-gray-500">No data in this range.</p>
      )}
    </Card>
  );
}

import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { companyList } from "@/lib/audience";
import { Button, Card, EmptyState, Input, PageHeader, cx } from "@/components/ui";

const SORTS = { users: "Most users", active: "Most active", recent: "Recently seen" } as const;
type Sort = keyof typeof SORTS;

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { ws } = await params;
  const sp = await searchParams;
  const { workspace } = await requireWorkspace(ws);
  const q = sp.q?.trim() || undefined;
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "users";
  const { totalCompanies, withoutCompany, rows } = await companyList(ws, { q, sort, limit: 500 });
  const qs = (p: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.entries({ q, sort, ...p }).filter((e): e is [string, string] => !!e[1]))}`;
  const attrs =
    workspace.companyIdAttribute || workspace.companyNameAttribute
      ? `${workspace.companyIdAttribute ?? "auto"} / ${workspace.companyNameAttribute ?? "auto"}`
      : "detected automatically";

  return (
    <>
      <PageHeader
        title="Companies"
        description={`${totalCompanies} companies (publishers) · ${withoutCompany} users without a company`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="flex max-w-md flex-1 gap-2">
          <input type="hidden" name="sort" value={sort} />
          <Input name="q" defaultValue={q} placeholder="Search by company name or id" />
          <Button variant="secondary">Search</Button>
        </form>
        <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-gray-200">
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link
              key={s}
              href={qs({ sort: s })}
              className={cx("rounded-md px-3 py-1 text-sm font-medium", s === sort ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:text-gray-900")}
            >
              {SORTS[s]}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={q ? "No matching companies" : "No companies yet"}>
          {!q && (
            <>
              Users are grouped by the company attributes they send with <code>identify()</code> (here: {attrs}).{" "}
              <Link href={`/app/${ws}/settings`} className="font-medium text-indigo-600 hover:underline">
                Change in Settings
              </Link>
              .
            </>
          )}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-3 py-3 text-right font-medium">Users</th>
                <th className="px-3 py-3 text-right font-medium" title="First seen in the last 7 days">
                  New (7d)
                </th>
                <th className="px-3 py-3 text-right font-medium">Weekly active</th>
                <th className="px-3 py-3 text-right font-medium">Monthly active</th>
                <th className="px-3 py-3 text-right font-medium" title="Not seen for 30 days or more">
                  Inactive
                </th>
                <th className="px-3 py-3 text-right font-medium">Guides completed</th>
                <th className="px-5 py-3 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => {
                const users = (segment?: string) =>
                  `/app/${ws}/users?${new URLSearchParams({ company: c.companyId, ...(segment ? { segment } : {}) })}`;
                return (
                  <tr key={c.companyId} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={users()} className="font-medium hover:text-indigo-600">
                        {c.companyName ?? c.companyId}
                      </Link>
                      {c.companyName && c.companyName !== c.companyId && <div className="font-mono text-xs text-gray-400">{c.companyId}</div>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.users}</td>
                    <Cell href={users("new")} value={c.newUsers} />
                    <Cell href={users("weekly")} value={c.weekly} />
                    <Cell href={users("monthly")} value={c.monthly} />
                    <Cell href={users("inactive")} value={c.inactive} />
                    <td className="px-3 py-3 text-right tabular-nums">{c.completions}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-gray-500">{c.lastSeenAt.toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-gray-500">
        Company attributes: {attrs}.{" "}
        <Link href={`/app/${ws}/settings`} className="font-medium text-indigo-600 hover:underline">
          Settings
        </Link>
      </p>
    </>
  );
}

function Cell({ href, value }: { href: string; value: number }) {
  return (
    <td className="px-3 py-3 text-right tabular-nums">
      {value ? (
        <Link href={href} className="hover:text-indigo-600 hover:underline">
          {value}
        </Link>
      ) : (
        <span className="text-gray-400">0</span>
      )}
    </td>
  );
}

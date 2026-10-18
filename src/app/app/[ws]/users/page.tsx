import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { endUserList, fieldLabel, filterOptions, segmentCounts, segments, type Segment } from "@/lib/audience";
import { Badge, Button, Card, EmptyState, Input, PageHeader, cx } from "@/components/ui";
import { FilterBar } from "./filter-bar";
import { filtersToQuery, parseUserFilters } from "./filters";

const PAGE_SIZE = 50;

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { ws } = await params;
  const sp = await searchParams;
  await requireWorkspace(ws);
  const filters = parseUserFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ total, users }, counts, options] = await Promise.all([
    endUserList(ws, { ...filters, page, pageSize: PAGE_SIZE }),
    segmentCounts(ws, { ...filters, segment: undefined }),
    filterOptions(ws),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = filtersToQuery(filters);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `?${p}`;
  };
  const segment = filters.segment ?? "all";
  const companyName = filters.company && options.company.find((c) => c.id === filters.company)?.name;

  return (
    <>
      <PageHeader
        title={companyName ? `Users at ${companyName}` : "Users"}
        description={`${total} ${total === 1 ? "person" : "people"} ${segment === "all" ? "seen by the snippet" : `· ${segments[segment].hint.toLowerCase()}`}`}
        actions={
          // Plain link: the export is a file download, not a page.
          <a
            href={`/app/${ws}/users/export${qs({ page: undefined })}`}
            className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Export CSV
          </a>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        {(Object.keys(segments) as Segment[]).map((s) => (
          <Link
            key={s}
            href={qs({ segment: s === "all" ? undefined : s, page: undefined })}
            title={segments[s].hint || undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              s === segment ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-600 hover:text-gray-900",
            )}
          >
            {segments[s].label} <span className="ml-1 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600 tabular-nums">{counts[s]}</span>
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="flex w-full max-w-sm gap-2">
          {[...filtersToQuery({ ...filters, q: undefined })].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Input name="q" defaultValue={filters.q} placeholder="Search user id or company" />
          <Button variant="secondary">Search</Button>
        </form>
        <FilterBar
          filters={[
            { key: "company", label: "Company", options: options.company.map((c) => ({ value: c.id, label: c.name })) },
            { key: "browser", label: "Browser", options: options.browser.map((v) => ({ value: v, label: v })) },
            { key: "os", label: "OS", options: options.os.map((v) => ({ value: v, label: v })) },
            { key: "device", label: "Device", options: options.device.map((v) => ({ value: v, label: fieldLabel("device", v) })) },
            { key: "language", label: "Language", options: options.language.map((v) => ({ value: v, label: fieldLabel("language", v) })) },
          ]}
        />
      </div>

      {users.length === 0 ? (
        <EmptyState title={total === 0 && !Object.keys(filters).length ? "No users yet" : "No matching users"}>
          {!Object.keys(filters).length && "Users appear once the snippet loads on your site and calls identify()."}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Company</th>
                <th className="px-3 py-3 font-medium">Device</th>
                <th className="px-3 py-3 font-medium">Language</th>
                <th className="px-3 py-3 text-right font-medium">Guides completed</th>
                <th className="px-3 py-3 text-right font-medium">First seen</th>
                <th className="px-5 py-3 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/app/${ws}/users/${u.id}`} className="font-medium hover:text-indigo-600">
                      {u.anonymous ? "Anonymous visitor" : u.externalId}
                    </Link>
                    {u.anonymous && (
                      <div className="mt-0.5">
                        <Badge>anonymous</Badge>
                      </div>
                    )}
                  </td>
                  <td className="max-w-48 px-3 py-3">
                    {u.companyId ? (
                      <Link href={qs({ company: u.companyId, page: undefined })} className="block truncate hover:text-indigo-600">
                        {u.companyName ?? u.companyId}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-gray-600">
                    {u.browser ? `${u.browser} · ${u.os} · ${fieldLabel("device", u.device)}` : <span className="text-gray-400">Unknown</span>}
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-gray-600">
                    {u.language ? fieldLabel("language", u.language) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{u._count.progress}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">{u.firstSeenAt.toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-gray-500">{u.lastSeenAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="font-medium text-indigo-600" href={qs({ page: String(page - 1) })}>
                ← Previous
              </Link>
            )}
            {page < pages && (
              <Link className="font-medium text-indigo-600" href={qs({ page: String(page + 1) })}>
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

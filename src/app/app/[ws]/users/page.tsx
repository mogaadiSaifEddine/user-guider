import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { endUserList } from "@/lib/analytics";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";

const PAGE_SIZE = 50;

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { ws } = await params;
  const sp = await searchParams;
  await requireWorkspace(ws);
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { total, users } = await endUserList(ws, { q, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Users" description={`${total} people seen by the snippet`} />
      <form className="mb-4 flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by user id" />
        <Button variant="secondary">Search</Button>
      </form>

      {users.length === 0 ? (
        <EmptyState title={q ? "No matching users" : "No users yet"}>
          {!q && "Users appear once the snippet loads on your site and calls identify()."}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Attributes</th>
                <th className="px-3 py-3 text-right font-medium">Guides completed</th>
                <th className="px-5 py-3 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const attrs = Object.entries(u.attributes as Record<string, unknown>);
                return (
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
                    <td className="max-w-xs px-3 py-3 text-xs text-gray-500">
                      <div className="truncate">
                        {attrs.length ? attrs.slice(0, 4).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{u._count.progress}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-gray-500">{u.lastSeenAt.toLocaleString()}</td>
                  </tr>
                );
              })}
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
            {page > 1 && <Link className="font-medium text-indigo-600" href={qs(page - 1)}>← Previous</Link>}
            {page < pages && <Link className="font-medium text-indigo-600" href={qs(page + 1)}>Next →</Link>}
          </div>
        </div>
      )}
    </>
  );
}

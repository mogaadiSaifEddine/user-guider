import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { plainText } from "@/lib/format";
import {
  parseUpdatesPage,
  REACTION_EMOJI,
  reactionKinds,
  updateState,
} from "@/lib/updates";
import {
  labelsOf,
  pageUrl,
  parseUpdateContent,
  reactionCounts,
} from "@/lib/updates-service";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  cx,
} from "@/components/ui";
import { LabelChip, formatUpdateDate } from "@/components/update-post";
import { NewUpdateButton } from "./updates-client";
import { UpdateRowActions } from "./update-row-actions";

const tabs = [
  { key: "", label: "All" },
  { key: "published", label: "Published" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
] as const;

const stateBadge = {
  draft: { color: "gray", text: "draft" },
  scheduled: { color: "yellow", text: "scheduled" },
  published: { color: "green", text: "published" },
} as const;

export default async function UpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ state?: string; label?: string }>;
}) {
  const { ws } = await params;
  const { state = "", label } = await searchParams;
  const { workspace } = await requireWorkspace(ws);
  const page = parseUpdatesPage(workspace.updatesPage);
  const url = await pageUrl(workspace);
  const now = new Date();

  const all = await prisma.productUpdate.findMany({
    where: { workspaceId: ws },
    orderBy: [
      { pinned: "desc" },
      { publishedAt: { sort: "desc", nulls: "first" } },
      { updatedAt: "desc" },
    ],
    take: 1000,
  });
  const counts = await reactionCounts(all.map((u) => u.id));
  const byState = { draft: 0, scheduled: 0, published: 0 };
  for (const u of all) byState[updateState(u, now)]++;
  const shown = all.filter(
    (u) =>
      (!state || updateState(u, now) === state) &&
      (!label ||
        (Array.isArray(u.labels) && (u.labels as string[]).includes(label))),
  );
  const href = (p: { state?: string; label?: string | null }) => {
    const sp = new URLSearchParams();
    const s = p.state === undefined ? state : p.state;
    const l = p.label === undefined ? label : p.label;
    if (s) sp.set("state", s);
    if (l) sp.set("label", l);
    return `/app/${ws}/updates${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Product updates"
        description={
          <>
            Your changelog: a public page and a &ldquo;What&apos;s new&rdquo;
            section in the resource center.{" "}
            <a
              href="/docs/product-updates"
              target="_blank"
              className="font-medium text-brand-600 hover:underline"
            >
              How it works
            </a>
          </>
        }
        actions={
          <>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                View page ↗
              </a>
            )}
            <ButtonLink
              variant="secondary"
              href={`/app/${ws}/import?from=updates`}
            >
              Import from UserGuiding
            </ButtonLink>
            <ButtonLink
              variant="secondary"
              href={`/app/${ws}/updates/settings`}
            >
              Page settings
            </ButtonLink>
            <NewUpdateButton ws={ws} />
          </>
        }
      />

      {!url && (
        <Card className="mb-5 flex flex-wrap items-center gap-3 border-l-4 border-brand-400 px-5 py-4">
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-gray-900">
              Your public updates page is off
            </div>
            <div className="text-gray-500">
              Pick an address and turn it on to share your changelog with a
              link. The resource center works either way.
            </div>
          </div>
          <ButtonLink variant="secondary" href={`/app/${ws}/updates/settings`}>
            Set up the page
          </ButtonLink>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav className="flex rounded-lg bg-white p-1 shadow-xs ring-1 ring-gray-200">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={href({ state: t.key })}
              className={cx(
                "rounded-md px-3 py-1 text-sm font-medium",
                state === t.key
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-gray-400 tabular-nums">
                {t.key ? byState[t.key] : all.length}
              </span>
            </Link>
          ))}
        </nav>
        {page.labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {page.labels.map((l) => (
              <Link
                key={l.id}
                href={href({ label: label === l.id ? null : l.id })}
                className={cx(
                  "rounded-full transition",
                  label && label !== l.id && "opacity-40 hover:opacity-100",
                  label === l.id && "ring-2 ring-brand-300",
                )}
              >
                <LabelChip name={l.name} color={l.color} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {!shown.length ? (
        <EmptyState title={all.length ? "Nothing here" : "No updates yet"}>
          {!all.length && (
            <>
              Write about what you shipped: new features, improvements, fixes.
              Published posts show on your updates page and in any resource
              center with a What&apos;s new section. Moving from UserGuiding?{" "}
              <Link
                href={`/app/${ws}/import?from=updates`}
                className="font-medium text-brand-600 hover:underline"
              >
                Import your existing posts
              </Link>
              .
            </>
          )}
        </EmptyState>
      ) : (
        <Card className="divide-y divide-gray-100 overflow-hidden">
          {shown.map((u) => {
            const content = parseUpdateContent(u.content);
            const s = updateState(u, now);
            const c = counts.get(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-2 pr-3 hover:bg-gray-50"
              >
                <Link
                  href={`/app/${ws}/updates/${u.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-4"
                >
                  <div className="hidden h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-linear-to-br from-brand-100 to-brand-200 sm:block">
                    {u.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.coverUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {u.pinned && (
                        <span
                          title="Pinned to the top"
                          className="text-brand-500"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M16 3H8v2l1 1v5l-3 3v2h5v6l1 1 1-1v-6h5v-2l-3-3V6l1-1z" />
                          </svg>
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {plainText(content.title) || "Untitled update"}
                      </span>
                    </div>
                    {content.summary && (
                      <div className="truncate text-xs text-gray-500">
                        {plainText(content.summary)}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {labelsOf(page, u.labels).map((l) => (
                        <LabelChip key={l.id} name={l.name} color={l.color} />
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge color={stateBadge[s].color}>
                      {stateBadge[s].text}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {s === "draft"
                        ? `Edited ${formatUpdateDate(u.updatedAt)}`
                        : formatUpdateDate(u.publishedAt!)}
                    </span>
                    {c && (
                      <span className="flex gap-2 text-xs text-gray-500 tabular-nums">
                        {reactionKinds.map((k) =>
                          c[k] ? (
                            <span key={k}>
                              {REACTION_EMOJI[k]} {c[k]}
                            </span>
                          ) : null,
                        )}
                      </span>
                    )}
                  </div>
                </Link>
                <UpdateRowActions
                  ws={ws}
                  postUrl={url ? `${url}/${u.id}` : null}
                  update={{
                    id: u.id,
                    title: plainText(content.title) || "Untitled update",
                    state: s,
                    pinned: u.pinned,
                    reactions: c
                      ? reactionKinds.reduce((n, k) => n + c[k], 0)
                      : 0,
                  }}
                />
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { languageName, workspaceLanguages } from "@/lib/i18n";
import { isOutdated, parseCollectionTranslations, parseKbContent, parseKbTranslations } from "@/lib/kb";
import { plainText } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { CollectionsPanel, NewArticleButton } from "./knowledge-client";

const sourceLabels = { MANUAL: null, ZENDESK: "Zendesk", INTERCOM: "Intercom" } as const;

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const { ws } = await params;
  const { c, q } = await searchParams;
  const { workspace } = await requireWorkspace(ws);
  const languages = workspaceLanguages(workspace.languages);
  const query = (q ?? "").trim().slice(0, 100);

  const [collections, articles, counts] = await Promise.all([
    prisma.kbCollection.findMany({ where: { workspaceId: ws }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.kbArticle.findMany({
      where: {
        workspaceId: ws,
        ...(c === "none" ? { collectionId: null } : c ? { collectionId: c } : {}),
        ...(query ? { searchText: { contains: query.toLowerCase() } } : {}),
      },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      take: 500,
    }),
    prisma.kbArticle.groupBy({ by: ["collectionId"], where: { workspaceId: ws }, _count: true }),
  ]);
  const countBy = new Map(counts.map((x) => [x.collectionId ?? "none", x._count]));
  const total = counts.reduce((n, x) => n + x._count, 0);
  const collectionName = new Map(collections.map((x) => [x.id, x.name]));
  const href = (p: { c?: string | null; q?: string }) => {
    const sp = new URLSearchParams();
    const cc = p.c === undefined ? c : p.c;
    const qq = p.q === undefined ? query : p.q;
    if (cc) sp.set("c", cc);
    if (qq) sp.set("q", qq);
    return `/app/${ws}/knowledge${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description={
          <>
            Help articles for your resource center, in every language you use.{" "}
            <a href="/docs/knowledge-base" target="_blank" className="font-medium text-brand-600 hover:underline">
              How it works
            </a>
          </>
        }
        actions={
          <>
            <ButtonLink variant="secondary" href={`/app/${ws}/knowledge/import`}>
              Import from Zendesk or Intercom
            </ButtonLink>
            <NewArticleButton ws={ws} collectionId={c && c !== "none" ? c : null} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-2">
            <nav className="space-y-0.5 text-sm">
              <FilterLink href={href({ c: null })} active={!c} label="All articles" count={total} />
              {collections.map((x) => (
                <FilterLink key={x.id} href={href({ c: x.id })} active={c === x.id} label={x.name} count={countBy.get(x.id) ?? 0} />
              ))}
              {(countBy.get("none") ?? 0) > 0 && (
                <FilterLink href={href({ c: "none" })} active={c === "none"} label="No collection" count={countBy.get("none") ?? 0} />
              )}
            </nav>
          </Card>
          <CollectionsPanel
            ws={ws}
            languages={languages}
            collections={collections.map((x) => ({
              id: x.id,
              name: x.name,
              description: x.description ?? "",
              translations: parseCollectionTranslations(x.translations),
              source: sourceLabels[x.source],
            }))}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <form className="flex gap-2" action={`/app/${ws}/knowledge`}>
            {c && <input type="hidden" name="c" value={c} />}
            <input
              name="q"
              defaultValue={query}
              placeholder="Search articles, in any language"
              className="block w-full rounded-md border-0 bg-white px-2.5 py-1.5 text-sm ring-1 ring-gray-300 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </form>
          {!articles.length ? (
            <EmptyState title={query ? "No articles match" : total ? "No articles here" : "No articles yet"}>
              {!total && "Write your first article, or import your help center from Zendesk or Intercom. Then add a Knowledge base section to your resource center."}
            </EmptyState>
          ) : (
            <Card className="divide-y divide-gray-100">
              {articles.map((a) => {
                const content = parseKbContent(a.content);
                const translations = parseKbTranslations(a.translations);
                const langs = languages.slice(1);
                return (
                  <Link key={a.id} href={`/app/${ws}/knowledge/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{plainText(content.title) || "Untitled article"}</div>
                      <div className="truncate text-xs text-gray-500">
                        {a.collectionId ? collectionName.get(a.collectionId) : "No collection"}
                        {content.summary ? ` · ${plainText(content.summary)}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {langs.map((l) => {
                        const t = translations[l];
                        return (
                          <span
                            key={l}
                            title={`${languageName(l)}: ${!t ? "not translated" : isOutdated(content, t) ? "outdated" : "translated"}`}
                            className={cx(
                              "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ring-1",
                              !t ? "text-gray-400 ring-gray-200" : isOutdated(content, t) ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                            )}
                          >
                            {l}
                          </span>
                        );
                      })}
                      {sourceLabels[a.source] && <Badge>{sourceLabels[a.source]}</Badge>}
                      <Badge color={a.status === "PUBLISHED" ? "green" : "gray"}>{a.status === "PUBLISHED" ? "published" : "draft"}</Badge>
                    </div>
                  </Link>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function FilterLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5",
        active ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700 hover:bg-gray-50",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-gray-400 tabular-nums">{count}</span>
    </Link>
  );
}

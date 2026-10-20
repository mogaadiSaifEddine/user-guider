import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseTheme } from "@/lib/guide-schema";
import { publicOrder, publicWhere, workspaceBySlug } from "@/lib/updates-service";
import { LabelChip } from "@/components/update-post";
import { PageShell, PostArticle, pageLocale, withLang } from "./shared";

const PER_PAGE = 10;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ label?: string; page?: string; lang?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await workspaceBySlug(slug);
  if (!found) return { title: "Not found" };
  return {
    title: found.page.title,
    description: found.page.description,
    alternates: { types: { "application/rss+xml": `/updates/${slug}/rss.xml` } },
    openGraph: { title: found.page.title, description: found.page.description },
  };
}

export default async function PublicUpdatesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { label, page: pageParam, lang } = await searchParams;
  const found = await workspaceBySlug(slug);
  if (!found) notFound();
  const { workspace, page } = found;
  const { languages, locale, explicit } = await pageLocale(workspace, lang);
  const accent = parseTheme(workspace.theme).primaryColor;
  const pageNo = Math.max(1, Math.min(1000, Number(pageParam) || 1));
  const activeLabel = page.labels.find((l) => l.id === label) ?? null;

  // Labels live in a JSON array, so filter in memory; changelogs are small.
  const all = await prisma.productUpdate.findMany({ where: publicWhere(workspace.id), orderBy: publicOrder, take: 2000 });
  const matching = activeLabel ? all.filter((u) => Array.isArray(u.labels) && (u.labels as string[]).includes(activeLabel.id)) : all;
  const posts = matching.slice((pageNo - 1) * PER_PAGE, pageNo * PER_PAGE);
  const more = matching.length > pageNo * PER_PAGE;
  const href = (p: { label?: string | null; page?: number }) => {
    const sp = new URLSearchParams();
    const l = p.label === undefined ? activeLabel?.id : p.label;
    if (l) sp.set("label", l);
    if (p.page && p.page > 1) sp.set("page", String(p.page));
    return withLang(`/updates/${slug}${sp.size ? `?${sp}` : ""}`, locale, explicit);
  };

  return (
    <PageShell slug={slug} page={page} accent={accent} languages={languages} locale={locale} path={href({ page: pageNo })}>
      <section className="border-b border-gray-200/70" style={{ background: `linear-gradient(180deg, ${accent}17, transparent 85%)` }}>
        <div className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{page.title}</h1>
          {page.description && <p className="mx-auto mt-3 max-w-xl text-base text-gray-500">{page.description}</p>}
          {page.labels.length > 0 && (
            <nav className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Filter by label">
              <Link
                href={href({ label: null })}
                className={
                  "rounded-full px-3 py-1 text-xs font-bold ring-1 transition " +
                  (!activeLabel ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-600 ring-gray-200 hover:ring-gray-300")
                }
              >
                All
              </Link>
              {page.labels.map((l) => (
                <Link
                  key={l.id}
                  href={href({ label: activeLabel?.id === l.id ? null : l.id })}
                  className={"rounded-full transition " + (activeLabel && activeLabel.id !== l.id ? "opacity-50 hover:opacity-100" : "") + (activeLabel?.id === l.id ? " ring-2 ring-offset-2 ring-gray-900" : "")}
                >
                  <LabelChip name={l.name} color={l.color} />
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {!posts.length ? (
          <div className="rounded-2xl bg-white px-6 py-16 text-center text-sm text-gray-500 shadow-card ring-1 ring-gray-200/70">
            {activeLabel ? `No updates labeled ${activeLabel.name} yet.` : "No updates yet. Check back soon."}
          </div>
        ) : (
          posts.map((u) => (
            <PostArticle key={u.id} slug={slug} u={u} page={page} workspace={workspace} locale={locale} explicitLocale={explicit} />
          ))
        )}
        {(pageNo > 1 || more) && (
          <nav className="flex justify-between md:pl-[182px]">
            {pageNo > 1 ? (
              <Link href={href({ page: pageNo - 1 })} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-xs ring-1 ring-gray-200 hover:bg-gray-50">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            {more && (
              <Link href={href({ page: pageNo + 1 })} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-xs ring-1 ring-gray-200 hover:bg-gray-50">
                Older updates →
              </Link>
            )}
          </nav>
        )}
      </main>
    </PageShell>
  );
}

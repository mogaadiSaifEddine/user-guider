import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { plainText, safeUrl } from "@/lib/format";
import { parseTheme } from "@/lib/guide-schema";
import { localizeUpdate, publicWhere, workspaceBySlug } from "@/lib/updates-service";
import { PageShell, PostArticle, pageLocale, withLang } from "../shared";

type Props = { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ lang?: string }> };

async function load(slug: string, id: string) {
  const found = await workspaceBySlug(slug);
  if (!found) return null;
  const u = await prisma.productUpdate.findFirst({ where: { id: id.slice(0, 64), ...publicWhere(found.workspace.id) } });
  return u ? { ...found, u } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const data = await load(slug, id);
  if (!data) return { title: "Not found" };
  const { locale } = await pageLocale(data.workspace, (await searchParams).lang);
  const c = localizeUpdate(data.u, locale);
  const cover = data.u.coverUrl ? safeUrl(data.u.coverUrl) : "";
  return {
    title: `${plainText(c.title)} · ${data.page.title}`,
    description: plainText(c.summary) || data.page.description,
    openGraph: { title: plainText(c.title), description: plainText(c.summary), ...(cover ? { images: [cover] } : {}) },
  };
}

export default async function PublicUpdatePage({ params, searchParams }: Props) {
  const { slug, id } = await params;
  const data = await load(slug, id);
  if (!data) notFound();
  const { workspace, page, u } = data;
  const { languages, locale, explicit } = await pageLocale(workspace, (await searchParams).lang);

  return (
    <PageShell
      slug={slug}
      page={page}
      accent={parseTheme(workspace.theme).primaryColor}
      languages={languages}
      locale={locale}
      path={`/updates/${slug}/${u.id}`}
    >
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <Link href={withLang(`/updates/${slug}`, locale, explicit)} className="inline-block text-sm font-semibold text-gray-500 hover:text-gray-900 md:ml-[182px]">
          ← {page.title}
        </Link>
        <PostArticle slug={slug} u={u} page={page} workspace={workspace} locale={locale} explicitLocale={explicit} full />
      </main>
    </PageShell>
  );
}

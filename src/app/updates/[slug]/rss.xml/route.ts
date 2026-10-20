import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { escapeHtml, plainText } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { labelsOf, localizeUpdate, publicWhere, workspaceBySlug } from "@/lib/updates-service";

// GET /updates/<slug>/rss.xml: the latest 30 published updates, in English.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await workspaceBySlug(slug);
  if (!found) return new Response("Not found", { status: 404 });
  const { workspace, page } = found;
  const base = `${await appUrl()}/updates/${workspace.updatesSlug}`;
  const posts = await prisma.productUpdate.findMany({ where: publicWhere(workspace.id), orderBy: { publishedAt: "desc" }, take: 30 });

  const items = posts
    .map((u) => {
      const c = localizeUpdate(u, DEFAULT_LOCALE);
      const link = `${base}/${u.id}`;
      return `<item>
  <title>${escapeHtml(plainText(c.title))}</title>
  <link>${link}</link>
  <guid isPermaLink="true">${link}</guid>
  <pubDate>${(u.publishedAt ?? u.createdAt).toUTCString()}</pubDate>
  ${labelsOf(page, u.labels).map((l) => `<category>${escapeHtml(l.name)}</category>`).join("")}
  <description>${escapeHtml(plainText(c.summary))}</description>
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeHtml(page.title)}</title>
  <link>${base}</link>
  <description>${escapeHtml(page.description)}</description>
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

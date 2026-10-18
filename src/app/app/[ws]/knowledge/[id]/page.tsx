import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { parseTheme } from "@/lib/guide-schema";
import { workspaceLanguages } from "@/lib/i18n";
import { parseKbContent, parseKbTranslations } from "@/lib/kb";
import { ArticleEditor } from "./article-editor";

export default async function ArticlePage({ params }: { params: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await params;
  const { workspace } = await requireWorkspace(ws);
  const article = await prisma.kbArticle.findFirst({ where: { id, workspaceId: ws } });
  if (!article) notFound();
  const [collections, guides] = await Promise.all([
    prisma.kbCollection.findMany({ where: { workspaceId: ws }, select: { id: true, name: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.guide.findMany({
      where: { workspaceId: ws, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ArticleEditor
      ws={ws}
      article={{
        id: article.id,
        status: article.status,
        source: article.source,
        externalUrl: article.externalUrl,
        collectionId: article.collectionId,
        content: parseKbContent(article.content),
        translations: parseKbTranslations(article.translations),
        updatedAt: article.updatedAt.toISOString(),
      }}
      collections={collections}
      others={guides}
      languages={workspaceLanguages(workspace.languages)}
      aiEnabled={aiEnabled()}
      theme={parseTheme(workspace.theme)}
    />
  );
}

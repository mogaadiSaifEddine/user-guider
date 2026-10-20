import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { parseTheme } from "@/lib/guide-schema";
import { workspaceLanguages } from "@/lib/i18n";
import { parseLabelIds, parseUpdatesPage, type ReactionKind } from "@/lib/updates";
import { pageUrl, parseUpdateContent, parseUpdateTranslations, reactionCounts } from "@/lib/updates-service";
import { UpdateEditor } from "./update-editor";

export default async function UpdateEditorPage({ params }: { params: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await params;
  const { workspace } = await requireWorkspace(ws);
  const u = await prisma.productUpdate.findFirst({ where: { id, workspaceId: ws } });
  if (!u) notFound();
  const [guides, counts, comments] = await Promise.all([
    prisma.guide.findMany({
      where: { workspaceId: ws, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    reactionCounts([u.id]),
    prisma.productUpdateReaction.findMany({
      where: { updateId: u.id, comment: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  const url = await pageUrl(workspace);

  return (
    <UpdateEditor
      ws={ws}
      update={{
        id: u.id,
        status: u.status,
        publishedAt: u.publishedAt?.toISOString() ?? null,
        coverUrl: u.coverUrl ?? "",
        labels: parseLabelIds(u.labels),
        pinned: u.pinned,
        content: parseUpdateContent(u.content),
        translations: parseUpdateTranslations(u.translations),
      }}
      labels={parseUpdatesPage(workspace.updatesPage).labels}
      postUrl={url ? `${url}/${u.id}` : null}
      reactions={{
        counts: counts.get(u.id) ?? null,
        comments: comments.map((c) => ({
          visitor: c.visitor,
          reaction: c.reaction as ReactionKind,
          comment: c.comment ?? "",
          at: c.updatedAt.toISOString(),
        })),
      }}
      others={guides}
      languages={workspaceLanguages(workspace.languages)}
      aiEnabled={aiEnabled()}
      accent={parseTheme(workspace.theme).primaryColor}
    />
  );
}

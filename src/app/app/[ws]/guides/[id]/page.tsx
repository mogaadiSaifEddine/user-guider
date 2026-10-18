import { prisma } from "@/lib/db";
import { requireGuide } from "@/lib/auth";
import { parseContent, parseTargeting, type GuideTypeName } from "@/lib/guide-schema";
import { aiEnabled } from "@/lib/ai";
import { GuideEditor } from "./guide-editor";

export default async function GuidePage({ params }: { params: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await params;
  const { guide } = await requireGuide(ws, id);
  const others = await prisma.guide.findMany({
    where: { workspaceId: ws, id: { not: id }, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const content = parseContent(guide.type as GuideTypeName, guide.content);
  const unpublishedChanges =
    guide.status === "PUBLISHED" && JSON.stringify(guide.publishedContent) !== JSON.stringify(guide.content);

  return (
    <GuideEditor
      ws={ws}
      guide={{
        id: guide.id,
        name: guide.name,
        type: guide.type as GuideTypeName,
        status: guide.status,
        priority: guide.priority,
        content,
        targeting: parseTargeting(guide.targeting),
        unpublishedChanges,
        updatedAt: guide.updatedAt.toISOString(),
      }}
      others={others.map((g) => ({ id: g.id, name: g.name, type: g.type as GuideTypeName }))}
      aiEnabled={aiEnabled()}
    />
  );
}

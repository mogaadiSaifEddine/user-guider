import { prisma } from "@/lib/db";
import { requireGuide } from "@/lib/auth";
import { parseContent, parseTargeting, parseTheme, type GuideTypeName } from "@/lib/guide-schema";
import { aiEnabled } from "@/lib/ai";
import { pruneTranslations, workspaceLanguages, type Translations } from "@/lib/i18n";
import { guideFootprint } from "@/lib/analytics";
import { GuideEditor } from "./guide-editor";

export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { ws, id } = await params;
  const { tab } = await searchParams;
  const { guide, workspace } = await requireGuide(ws, id);
  const kbCollections = await prisma.kbCollection.findMany({
    where: { workspaceId: ws },
    select: { id: true, name: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const others = await prisma.guide.findMany({
    where: { workspaceId: ws, id: { not: id }, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const footprint = await guideFootprint(id);

  const content = parseContent(guide.type as GuideTypeName, guide.content);
  const languages = workspaceLanguages(workspace.languages);
  const translations = (guide.translations ?? {}) as Translations;
  const unpublishedChanges =
    guide.status === "PUBLISHED" &&
    (JSON.stringify(guide.publishedContent) !== JSON.stringify(guide.content) ||
      sortedJson(guide.publishedTranslations ?? {}) !== sortedJson(pruneTranslations(content, translations, languages)));

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
        translations,
        unpublishedChanges,
        updatedAt: guide.updatedAt.toISOString(),
        footprint,
      }}
      others={others.map((g) => ({ id: g.id, name: g.name, type: g.type as GuideTypeName }))}
      aiEnabled={aiEnabled()}
      languages={languages}
      kbCollections={kbCollections}
      theme={parseTheme(workspace.theme)}
      // ?tab=builder etc., e.g. from the guides list. Builder only exists for tours and hotspots.
      initialTab={tab === "translations" || tab === "targeting" || (tab === "builder" && (guide.type === "TOUR" || guide.type === "HOTSPOT")) ? tab : "content"}
    />
  );
}

// Postgres jsonb reorders object keys, so compare with sorted keys.
function sortedJson(v: unknown): string {
  return JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x,
  );
}

import "server-only";
import { prisma } from "./db";
import { DEFAULT_LOCALE, matchLocale, workspaceLanguages } from "./i18n";
import {
  localizeArticle,
  parseCollectionTranslations,
  parseKbContent,
  parseKbTranslations,
  type SdkKbArticle,
  type SdkKbArticleHeader,
  type SdkKbCollection,
} from "./kb";
import { SdkError } from "./sdk-service";

// Knowledge base reads for the SDK's resource center. Published articles are
// public help content, so a workspace's public key is enough; the SDK loads
// them when the panel opens, not with init.

async function workspaceFor(key: string, locale: string | null) {
  const workspace = await prisma.workspace.findUnique({ where: { publicKey: key }, select: { id: true, languages: true } });
  if (!workspace) throw new SdkError("Unknown workspace key", 404);
  return { id: workspace.id, locale: matchLocale([locale], workspaceLanguages(workspace.languages)) ?? DEFAULT_LOCALE };
}

const header = (
  a: { id: string; collectionId: string | null; content: unknown; translations: unknown },
  locale: string,
): SdkKbArticleHeader => {
  const c = localizeArticle(parseKbContent(a.content), parseKbTranslations(a.translations), locale);
  return { id: a.id, collectionId: a.collectionId, title: c.title, summary: c.summary };
};

export async function sdkKbList(input: { key: string; locale: string | null; collections: string[]; q: string }) {
  const ws = await workspaceFor(input.key, input.locale);
  const inCollections = input.collections.length ? { collectionId: { in: input.collections } } : {};
  const q = input.q.trim().toLowerCase().slice(0, 100);

  if (q) {
    // Every word must appear somewhere in the article, in any language.
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const hits = await prisma.kbArticle.findMany({
      where: { workspaceId: ws.id, status: "PUBLISHED", ...inCollections, AND: words.map((w) => ({ searchText: { contains: w } })) },
      select: { id: true, collectionId: true, content: true, translations: true },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      take: 40,
    });
    const articles = hits.map((a) => header(a, ws.locale));
    // Title matches first.
    articles.sort((a, b) => Number(b.title.toLowerCase().includes(q)) - Number(a.title.toLowerCase().includes(q)));
    return { locale: ws.locale, collections: [] as SdkKbCollection[], articles: articles.slice(0, 20) };
  }

  const [collections, articles] = await Promise.all([
    prisma.kbCollection.findMany({
      where: { workspaceId: ws.id, ...(input.collections.length ? { id: { in: input.collections } } : {}) },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.kbArticle.findMany({
      where: { workspaceId: ws.id, status: "PUBLISHED", ...inCollections },
      select: { id: true, collectionId: true, content: true, translations: true },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      take: 1000,
    }),
  ]);
  const counts = new Map<string, number>();
  for (const a of articles) if (a.collectionId) counts.set(a.collectionId, (counts.get(a.collectionId) ?? 0) + 1);
  return {
    locale: ws.locale,
    collections: collections
      .filter((c) => counts.get(c.id))
      .map((c): SdkKbCollection => {
        const t = parseCollectionTranslations(c.translations)[ws.locale];
        return {
          id: c.id,
          name: t?.name.trim() || c.name,
          description: t?.name.trim() ? t.description : (c.description ?? ""),
          count: counts.get(c.id) ?? 0,
        };
      }),
    articles: articles.map((a) => header(a, ws.locale)),
  };
}

export async function sdkKbArticle(input: { key: string; locale: string | null; id: string }): Promise<SdkKbArticle> {
  const ws = await workspaceFor(input.key, input.locale);
  const a = await prisma.kbArticle.findFirst({ where: { id: input.id, workspaceId: ws.id, status: "PUBLISHED" } });
  if (!a) throw new SdkError("Article not found", 404);
  const c = localizeArticle(parseKbContent(a.content), parseKbTranslations(a.translations), ws.locale);
  return { id: a.id, collectionId: a.collectionId, title: c.title, summary: c.summary, blocks: c.blocks };
}

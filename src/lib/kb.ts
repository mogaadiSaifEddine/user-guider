import { z } from "zod";
import { blockSchema, type Block } from "./guide-schema";
import { plainText } from "./format";
import { textHash } from "./i18n";

// Knowledge base articles: written here or imported from Zendesk / Intercom,
// shown in the resource center. No server-only imports (the SDK uses the types).
//
// Unlike guides, an article's translation is a whole article of its own
// (title, summary, blocks): imported translations come as separate HTML with
// their own structure. `source` is textHash() of the English content it was
// made from, so we can tell when the English changed since.

export const kbContentSchema = z.object({
  title: z.string().max(255).default(""),
  summary: z.string().max(500).default(""),
  blocks: z.array(blockSchema).max(400).default([]),
});

export const kbTranslationSchema = kbContentSchema.extend({ source: z.string().max(32).default("") });

export const kbTranslationsSchema = z.record(z.string().max(35), kbTranslationSchema);

export const kbCollectionTranslationsSchema = z.record(
  z.string().max(35),
  z.object({ name: z.string().max(191).default(""), description: z.string().max(2000).default("") }),
);

export type KbContent = z.infer<typeof kbContentSchema>;
export type KbTranslation = z.infer<typeof kbTranslationSchema>;
export type KbTranslations = z.infer<typeof kbTranslationsSchema>;
export type KbCollectionTranslations = z.infer<typeof kbCollectionTranslationsSchema>;

// What the SDK gets.
export type SdkKbCollection = { id: string; name: string; description: string; count: number };
export type SdkKbArticleHeader = { id: string; collectionId: string | null; title: string; summary: string };
export type SdkKbArticle = SdkKbArticleHeader & { blocks: Block[] };

export function parseKbContent(raw: unknown): KbContent {
  const r = kbContentSchema.safeParse(raw ?? {});
  return r.success ? r.data : kbContentSchema.parse({});
}

export function parseKbTranslations(raw: unknown): KbTranslations {
  const r = kbTranslationsSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

export function parseCollectionTranslations(raw: unknown): KbCollectionTranslations {
  const r = kbCollectionTranslationsSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

export const kbHash = (c: KbContent) => textHash({ title: c.title, summary: c.summary, blocks: c.blocks });

export function isOutdated(content: KbContent, t: KbTranslation | undefined) {
  return Boolean(t && t.source && t.source !== kbHash(content));
}

// The article in `locale`, or English when it has no translation.
export function localizeArticle(content: KbContent, translations: KbTranslations, locale: string): KbContent {
  const t = translations[locale];
  if (!t || !t.title.trim()) return content;
  return { title: t.title, summary: t.summary, blocks: t.blocks.length ? t.blocks : content.blocks };
}

function blocksText(blocks: Block[]) {
  return blocks
    .map((b) => (b.type === "heading" || b.type === "text" ? plainText(b.text) : b.type === "image" ? b.alt : ""))
    .filter(Boolean)
    .join(" ");
}

// Words of every language, lower-cased, for LIKE searches.
export function searchTextOf(content: KbContent, translations: KbTranslations) {
  const parts = [content, ...Object.values(translations)].map((c) => `${plainText(c.title)} ${plainText(c.summary)} ${blocksText(c.blocks)}`);
  return parts.join("\n").toLowerCase().replace(/\s+/g, " ").slice(0, 200_000);
}

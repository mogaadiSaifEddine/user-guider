"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { AiError, aiEnabled } from "@/lib/ai";
import { translateTexts } from "@/lib/ai-translate";
import { applyTranslations, normalizeLocale, textFields, workspaceLanguages } from "@/lib/i18n";
import { newId } from "@/lib/guide-schema";
import { plainText } from "@/lib/format";
import {
  kbCollectionTranslationsSchema,
  kbContentSchema,
  kbHash,
  kbTranslationsSchema,
  parseKbContent,
  parseKbTranslations,
  searchTextOf,
  type KbContent,
  type KbTranslation,
} from "@/lib/kb";
import { importKnowledgeBase, ImportError, type ImportReport, type ImportSource } from "@/lib/kb-import";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function describe(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input";
}

async function requireArticle(ws: string, id: string) {
  await requireWorkspace(ws);
  const article = await prisma.kbArticle.findFirst({ where: { id, workspaceId: ws } });
  if (!article) throw new Error("Article not found");
  return article;
}

async function ownCollection(ws: string, id: string | null) {
  if (!id) return null;
  const c = await prisma.kbCollection.findFirst({ where: { id, workspaceId: ws }, select: { id: true } });
  return c?.id ?? null;
}

// ---------- Articles ----------

export async function createArticle(ws: string, collectionId: string | null) {
  await requireWorkspace(ws);
  const content: KbContent = {
    title: "Untitled article",
    summary: "",
    blocks: [{ type: "text", id: newId(), text: "", align: "left" }],
  };
  const article = await prisma.kbArticle.create({
    data: {
      workspaceId: ws,
      collectionId: await ownCollection(ws, collectionId),
      title: content.title,
      content: content as unknown as Prisma.InputJsonObject,
      searchText: searchTextOf(content, {}),
    },
  });
  redirect(`/app/${ws}/knowledge/${article.id}`);
}

const saveSchema = z.object({
  content: kbContentSchema,
  translations: kbTranslationsSchema,
  collectionId: z.string().max(64).nullable(),
});

export async function saveArticle(ws: string, id: string, input: unknown): Promise<ActionResult> {
  await requireArticle(ws, id);
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const { content, translations } = parsed.data;
  if (!plainText(content.title)) return { ok: false, error: "The article needs a title." };
  // Drop empty translations.
  for (const [l, t] of Object.entries(translations)) if (!t.title.trim() && !t.blocks.length) delete translations[l];
  await prisma.kbArticle.update({
    where: { id },
    data: {
      title: plainText(content.title).slice(0, 255),
      content: content as unknown as Prisma.InputJsonObject,
      translations: translations as unknown as Prisma.InputJsonObject,
      searchText: searchTextOf(content, translations),
      collectionId: await ownCollection(ws, parsed.data.collectionId),
    },
  });
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message: "Saved." };
}

export async function setArticleStatus(ws: string, id: string, status: "DRAFT" | "PUBLISHED"): Promise<ActionResult> {
  await requireArticle(ws, id);
  await prisma.kbArticle.update({ where: { id }, data: { status } });
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message: status === "PUBLISHED" ? "Published. Resource centers show it right away." : "Unpublished." };
}

export async function deleteArticle(ws: string, id: string) {
  await requireArticle(ws, id);
  await prisma.kbArticle.delete({ where: { id } });
  revalidatePath(`/app/${ws}/knowledge`);
  redirect(`/app/${ws}/knowledge`);
}

// ---------- List row actions ----------

// A draft copy in the same collection, with its translations. It's a manual
// article: importing again won't touch it.
export async function duplicateArticle(ws: string, id: string): Promise<ActionResult> {
  const a = await requireArticle(ws, id);
  const content = parseKbContent(a.content);
  const translations = parseKbTranslations(a.translations);
  const title = `Copy of ${plainText(content.title) || "article"}`;
  const copy: KbContent = { ...content, title };
  // The translations were made from the original's text; keep them current against the copy.
  const hash = kbHash(content);
  const copyHash = kbHash(copy);
  for (const t of Object.values(translations)) if (t.source === hash) t.source = copyHash;
  await prisma.kbArticle.create({
    data: {
      workspaceId: ws,
      collectionId: a.collectionId,
      title: title.slice(0, 255),
      content: copy as unknown as Prisma.InputJsonObject,
      translations: translations as unknown as Prisma.InputJsonObject,
      searchText: searchTextOf(copy, translations),
      position: a.position,
    },
  });
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message: "Duplicated as a draft." };
}

// Like deleteArticle, but stays on the list.
export async function removeArticle(ws: string, id: string): Promise<ActionResult> {
  await requireArticle(ws, id);
  await prisma.kbArticle.delete({ where: { id } });
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message: "Article deleted." };
}

// Applies one action to several articles from the list. `collectionId` is the target
// of "move" (null = no collection).
export async function bulkArticles(
  ws: string,
  input: unknown,
  action: "publish" | "unpublish" | "move" | "delete",
  collectionId: string | null = null,
): Promise<ActionResult> {
  await requireWorkspace(ws);
  const ids = z.array(z.string().max(64)).min(1).max(1000).safeParse(input);
  if (!ids.success) return { ok: false, error: "Select at least one article." };
  const where = { workspaceId: ws, id: { in: ids.data } };
  const n = (c: number) => `${c} article${c === 1 ? "" : "s"}`;
  let message: string;
  if (action === "delete") {
    const { count } = await prisma.kbArticle.deleteMany({ where });
    message = `Deleted ${n(count)}.`;
  } else if (action === "move") {
    const target = await ownCollection(ws, collectionId);
    if (collectionId && !target) return { ok: false, error: "That collection no longer exists." };
    const { count } = await prisma.kbArticle.updateMany({ where, data: { collectionId: target } });
    message = `Moved ${n(count)}.`;
  } else {
    const status = action === "publish" ? "PUBLISHED" : "DRAFT";
    const { count } = await prisma.kbArticle.updateMany({ where: { ...where, status: { not: status } }, data: { status } });
    message = `${action === "publish" ? "Published" : "Unpublished"} ${n(count)}.`;
  }
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message };
}

// Translates the English article with AI; returns it for review, nothing is saved.
export async function aiTranslateArticle(
  ws: string,
  locale: string,
  content: unknown,
): Promise<ActionResult & { translation?: KbTranslation; skipped?: number }> {
  const { workspace } = await requireWorkspace(ws);
  if (!aiEnabled()) return { ok: false, error: "AI isn't set up on this server (GEMINI_API_KEY is missing)." };
  const target = normalizeLocale(locale);
  if (!target || target === "en" || !workspaceLanguages(workspace.languages).includes(target))
    return { ok: false, error: "Add that language in Settings first." };
  const parsed = kbContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const fields = textFields(parsed.data);
  try {
    const texts = await translateTexts(
      fields.map((f) => ({ key: f.key, text: f.text, rich: f.rich })),
      target,
      workspace.aiContext ?? "",
    );
    const map = Object.fromEntries(Object.entries(texts).map(([k, text]) => [k, { text, source: "" }]));
    const translated = applyTranslations(parsed.data, map);
    const skipped = fields.filter((f) => !texts[f.key]).length;
    return {
      ok: true,
      translation: { ...translated, source: kbHash(parsed.data) },
      skipped,
      message: skipped ? `Translated. ${skipped} texts stayed in English; check them before saving.` : "Translated. Review, then save.",
    };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    throw e;
  }
}

// ---------- Collections ----------

const collectionSchema = z.object({
  name: z.string().trim().min(1, "Name the collection").max(191),
  description: z.string().max(2000).default(""),
  translations: kbCollectionTranslationsSchema.default({}),
});

export async function saveCollection(ws: string, id: string | null, input: unknown): Promise<ActionResult> {
  await requireWorkspace(ws);
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const translations = Object.fromEntries(Object.entries(parsed.data.translations).filter(([, t]) => t.name.trim()));
  const data = { name: parsed.data.name, description: parsed.data.description.trim() || null, translations };
  if (id) {
    const own = await ownCollection(ws, id);
    if (!own) return { ok: false, error: "Collection not found." };
    await prisma.kbCollection.update({ where: { id }, data });
  } else {
    const last = await prisma.kbCollection.aggregate({ where: { workspaceId: ws }, _max: { position: true } });
    await prisma.kbCollection.create({ data: { workspaceId: ws, position: (last._max.position ?? 0) + 1, ...data } });
  }
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message: "Saved." };
}

export async function deleteCollection(ws: string, id: string): Promise<ActionResult> {
  await requireWorkspace(ws);
  if (!(await ownCollection(ws, id))) return { ok: false, error: "Collection not found." };
  // Its articles stay, without a collection.
  await prisma.kbCollection.delete({ where: { id } });
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true, message: "Collection deleted. Its articles are now uncategorized." };
}

export async function reorderCollections(ws: string, ids: string[]): Promise<ActionResult> {
  await requireWorkspace(ws);
  const own = await prisma.kbCollection.findMany({ where: { workspaceId: ws, id: { in: ids.slice(0, 500) } }, select: { id: true } });
  const ok = new Set(own.map((c) => c.id));
  await prisma.$transaction(ids.filter((id) => ok.has(id)).map((id, i) => prisma.kbCollection.update({ where: { id }, data: { position: i } })));
  revalidatePath(`/app/${ws}/knowledge`, "layout");
  return { ok: true };
}

// ---------- Import ----------

const importSchema = z.object({
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("zendesk"),
      url: z.string().trim().min(1, "Enter your Zendesk subdomain or help center address").max(300),
      email: z.string().max(200).optional(),
      token: z.string().max(200).optional(),
    }),
    z.object({
      kind: z.literal("intercom"),
      token: z.string().trim().min(1, "Enter an Intercom access token").max(500),
      region: z.enum(["us", "eu", "au"]),
    }),
    z.object({
      kind: z.literal("userguiding"),
      url: z.string().trim().min(1, "Enter your UserGuiding knowledge base address or container id").max(2000),
    }),
  ]),
  status: z.enum(["source", "draft"]),
  copyImages: z.boolean().default(false),
});

export async function runImport(ws: string, input: unknown): Promise<(ActionResult & { report?: ImportReport })> {
  await requireWorkspace(ws);
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  try {
    const report = await importKnowledgeBase(ws, parsed.data.source as ImportSource, {
      status: parsed.data.status,
      copyImages: parsed.data.copyImages,
    });
    revalidatePath(`/app/${ws}/knowledge`, "layout");
    return { ok: true, report };
  } catch (e) {
    if (e instanceof ImportError) return { ok: false, error: e.message };
    console.error("[kb-import]", e);
    return { ok: false, error: "The import failed unexpectedly. Check the server log." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { newId } from "@/lib/guide-schema";
import { plainText, safeUrl } from "@/lib/format";
import {
  parseUpdatesPage,
  SLUG_RE,
  updateContentSchema,
  updatesPageSchema,
  updateTranslationsSchema,
  type UpdateContent,
} from "@/lib/updates";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function describe(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input";
}

async function requireUpdate(ws: string, id: string) {
  await requireWorkspace(ws);
  const u = await prisma.productUpdate.findFirst({ where: { id, workspaceId: ws } });
  if (!u) throw new Error("Update not found");
  return u;
}

function revalidate(ws: string) {
  revalidatePath(`/app/${ws}/updates`, "layout");
  revalidatePath("/updates", "layout");
}

export async function createUpdate(ws: string) {
  await requireWorkspace(ws);
  const content: UpdateContent = {
    title: "Untitled update",
    summary: "",
    blocks: [{ type: "text", id: newId(), text: "", align: "left" }],
  };
  const u = await prisma.productUpdate.create({
    data: { workspaceId: ws, title: content.title, content: content as unknown as Prisma.InputJsonObject, labels: [] },
  });
  redirect(`/app/${ws}/updates/${u.id}`);
}

const saveSchema = z.object({
  content: updateContentSchema,
  translations: updateTranslationsSchema,
  coverUrl: z.string().max(1000),
  labels: z.array(z.string().max(32)).max(20),
  pinned: z.boolean(),
  // ISO date; only used once the post is published (a future date = scheduled).
  publishedAt: z.string().max(40).nullable(),
});

export async function saveUpdate(ws: string, id: string, input: unknown): Promise<ActionResult> {
  const existing = await requireUpdate(ws, id);
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const { content, translations, coverUrl, labels, pinned } = parsed.data;
  if (!plainText(content.title)) return { ok: false, error: "The update needs a title." };
  if (coverUrl.trim() && !safeUrl(coverUrl)) return { ok: false, error: "The cover image needs an https:// address." };
  const publishedAt = parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null;
  if (publishedAt && Number.isNaN(publishedAt.getTime())) return { ok: false, error: "That publish date isn't valid." };
  for (const [l, t] of Object.entries(translations)) if (!t.title.trim() && !t.blocks.length) delete translations[l];
  const { workspace } = await requireWorkspace(ws);
  const known = new Set(parseUpdatesPage(workspace.updatesPage).labels.map((l) => l.id));
  await prisma.productUpdate.update({
    where: { id },
    data: {
      title: plainText(content.title).slice(0, 255),
      content: content as unknown as Prisma.InputJsonObject,
      translations: translations as unknown as Prisma.InputJsonObject,
      coverUrl: coverUrl.trim() || null,
      labels: [...new Set(labels)].filter((l) => known.has(l)),
      pinned,
      publishedAt: publishedAt ?? existing.publishedAt,
    },
  });
  revalidate(ws);
  return { ok: true, message: "Saved." };
}

// publishAt: ISO date for a scheduled post, null for now.
export async function publishUpdate(ws: string, id: string, publishAt: string | null): Promise<ActionResult> {
  await requireUpdate(ws, id);
  const when = publishAt ? new Date(publishAt) : new Date();
  if (Number.isNaN(when.getTime())) return { ok: false, error: "That publish date isn't valid." };
  await prisma.productUpdate.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: when } });
  revalidate(ws);
  return {
    ok: true,
    message: when > new Date() ? `Scheduled for ${when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` : "Published.",
  };
}

export async function unpublishUpdate(ws: string, id: string): Promise<ActionResult> {
  await requireUpdate(ws, id);
  await prisma.productUpdate.update({ where: { id }, data: { status: "DRAFT" } });
  revalidate(ws);
  return { ok: true, message: "Unpublished. It's a draft again." };
}

export async function deleteUpdate(ws: string, id: string) {
  await requireUpdate(ws, id);
  await prisma.productUpdate.delete({ where: { id } });
  revalidate(ws);
  redirect(`/app/${ws}/updates`);
}

// ---------- List row actions ----------

export async function setUpdatePinned(ws: string, id: string, pinned: boolean): Promise<ActionResult> {
  await requireUpdate(ws, id);
  await prisma.productUpdate.update({ where: { id }, data: { pinned } });
  revalidate(ws);
  return { ok: true, message: pinned ? "Pinned to the top." : "Unpinned." };
}

// A draft copy with the same content, labels and translations; reactions stay with the original.
export async function duplicateUpdate(ws: string, id: string): Promise<ActionResult> {
  const u = await requireUpdate(ws, id);
  const content = updateContentSchema.parse(u.content ?? {});
  const title = `Copy of ${plainText(content.title) || "update"}`;
  await prisma.productUpdate.create({
    data: {
      workspaceId: ws,
      title: title.slice(0, 255),
      content: { ...content, title } as unknown as Prisma.InputJsonObject,
      translations: (u.translations ?? undefined) as Prisma.InputJsonObject | undefined,
      coverUrl: u.coverUrl,
      labels: (u.labels ?? []) as Prisma.InputJsonArray,
    },
  });
  revalidate(ws);
  return { ok: true, message: "Duplicated as a draft." };
}

// Like deleteUpdate, but stays on the list.
export async function removeUpdate(ws: string, id: string): Promise<ActionResult> {
  await requireUpdate(ws, id);
  await prisma.productUpdate.delete({ where: { id } });
  revalidate(ws);
  return { ok: true, message: "Update deleted." };
}

// ---------- Page settings ----------

const settingsSchema = z.object({
  slug: z.string().trim().toLowerCase().max(64),
  page: updatesPageSchema,
});

export async function saveUpdatesSettings(ws: string, input: unknown): Promise<ActionResult> {
  await requireWorkspace(ws);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const { page } = parsed.data;
  const slug = parsed.data.slug || null;
  if (slug && !SLUG_RE.test(slug)) return { ok: false, error: "Use lowercase letters, numbers and dashes for the address." };
  if (page.enabled && !slug) return { ok: false, error: "Choose an address for the page first." };
  for (const [field, url] of [["logo", page.logoUrl], ["website link", page.websiteUrl]] as const)
    if (url.trim() && !safeUrl(url)) return { ok: false, error: `The ${field} needs an https:// address.` };
  const ids = page.labels.map((l) => l.id);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Two labels have the same id." };
  if (slug) {
    const taken = await prisma.workspace.findFirst({ where: { updatesSlug: slug, id: { not: ws } }, select: { id: true } });
    if (taken) return { ok: false, error: "That address is taken. Try another." };
  }
  await prisma.workspace.update({
    where: { id: ws },
    data: { updatesSlug: slug, updatesPage: page as unknown as Prisma.InputJsonObject },
  });
  revalidate(ws);
  return { ok: true, message: page.enabled ? "Saved. The page is live." : "Saved. The page is off." };
}

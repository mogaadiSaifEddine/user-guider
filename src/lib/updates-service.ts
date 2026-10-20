import "server-only";
import { z } from "zod";
import type { ProductUpdate, Workspace } from "@prisma/client";
import { prisma } from "./db";
import { verifyUserHash } from "./keys";
import { DEFAULT_LOCALE, matchLocale, workspaceLanguages } from "./i18n";
import { localizeArticle } from "./kb";
import { appUrl } from "./app-url";
import { SdkError } from "./sdk-service";
import {
  emptyCounts,
  parseLabelIds,
  parseUpdatesPage,
  reactionKinds,
  updateContentSchema,
  updateTranslationsSchema,
  type ReactionCounts,
  type ReactionKind,
  type SdkUpdate,
  type SdkUpdateHeader,
  type SdkUpdateLabel,
  type SdkUpdateList,
  type UpdateContent,
  type UpdatesPage,
} from "./updates";

// Reads for the public updates page and the SDK, and reader reactions.
// Published posts are public, so the workspace's public key (SDK) or the
// page slug (public page) is enough to read them.

export const publicWhere = (workspaceId: string) => ({
  workspaceId,
  status: "PUBLISHED" as const,
  publishedAt: { lte: new Date() },
});

export const publicOrder = [{ pinned: "desc" as const }, { publishedAt: "desc" as const }];

export function parseUpdateContent(raw: unknown): UpdateContent {
  const r = updateContentSchema.safeParse(raw ?? {});
  return r.success ? r.data : updateContentSchema.parse({});
}

export function parseUpdateTranslations(raw: unknown) {
  const r = updateTranslationsSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

export function localizeUpdate(u: Pick<ProductUpdate, "content" | "translations">, locale: string) {
  return localizeArticle(parseUpdateContent(u.content), parseUpdateTranslations(u.translations), locale);
}

export function labelsOf(page: UpdatesPage, ids: unknown): SdkUpdateLabel[] {
  const byId = new Map(page.labels.map((l) => [l.id, l]));
  return parseLabelIds(ids).flatMap((id) => {
    const l = byId.get(id);
    return l ? [{ id: l.id, name: l.name, color: l.color }] : [];
  });
}

export function toHeader(u: ProductUpdate, page: UpdatesPage, locale: string): SdkUpdateHeader {
  const c = localizeUpdate(u, locale);
  return {
    id: u.id,
    title: c.title,
    summary: c.summary,
    coverUrl: u.coverUrl ?? "",
    labels: labelsOf(page, u.labels),
    publishedAt: (u.publishedAt ?? u.createdAt).toISOString(),
    pinned: u.pinned,
  };
}

export async function pageUrl(ws: Pick<Workspace, "updatesSlug" | "updatesPage">) {
  const page = parseUpdatesPage(ws.updatesPage);
  return page.enabled && ws.updatesSlug ? `${await appUrl()}/updates/${ws.updatesSlug}` : null;
}

export async function reactionCounts(updateIds: string[]) {
  const rows = updateIds.length
    ? await prisma.productUpdateReaction.groupBy({ by: ["updateId", "reaction"], where: { updateId: { in: updateIds } }, _count: true })
    : [];
  const out = new Map<string, ReactionCounts>();
  for (const r of rows) {
    const c = out.get(r.updateId) ?? emptyCounts();
    if ((reactionKinds as readonly string[]).includes(r.reaction)) c[r.reaction as ReactionKind] += r._count;
    out.set(r.updateId, c);
  }
  return out;
}

// ---------- SDK ----------

async function workspaceForKey(key: string, locale: string | null) {
  const workspace = await prisma.workspace.findUnique({ where: { publicKey: key } });
  if (!workspace) throw new SdkError("Unknown workspace key", 404);
  return { workspace, locale: matchLocale([locale], workspaceLanguages(workspace.languages)) ?? DEFAULT_LOCALE };
}

export async function sdkUpdatesList(input: { key: string; locale: string | null; limit: number }): Promise<SdkUpdateList> {
  const { workspace, locale } = await workspaceForKey(input.key, input.locale);
  const page = parseUpdatesPage(workspace.updatesPage);
  const rows = await prisma.productUpdate.findMany({ where: publicWhere(workspace.id), orderBy: publicOrder, take: input.limit });
  return { locale, pageUrl: await pageUrl(workspace), reactions: page.reactions, updates: rows.map((u) => toHeader(u, page, locale)) };
}

export const sdkVisitorSchema = z.object({
  id: z.string().min(1).max(191).optional(),
  anonymousId: z.string().min(1).max(191).optional(),
  hash: z.string().max(128).optional(),
});

// Who is reacting. With identity verification on, an identified user must carry a valid hash.
function sdkVisitor(workspace: Workspace, user: z.infer<typeof sdkVisitorSchema> | null) {
  if (user?.id) {
    if (workspace.requireIdentityVerification && !verifyUserHash(workspace.secretKey, user.id, user.hash))
      throw new SdkError("Identity verification failed", 403);
    return "u:" + user.id;
  }
  return user?.anonymousId ? "a:" + user.anonymousId : null;
}

export async function sdkUpdate(input: {
  key: string;
  locale: string | null;
  id: string;
  user: z.infer<typeof sdkVisitorSchema> | null;
}): Promise<SdkUpdate> {
  const { workspace, locale } = await workspaceForKey(input.key, input.locale);
  const u = await prisma.productUpdate.findFirst({ where: { id: input.id, ...publicWhere(workspace.id) } });
  if (!u) throw new SdkError("Update not found", 404);
  const page = parseUpdatesPage(workspace.updatesPage);
  // A wrong hash only hides the reader's own reaction here; reacting checks it properly.
  let visitor: string | null = null;
  try {
    visitor = sdkVisitor(workspace, input.user);
  } catch {}
  const mine = visitor
    ? await prisma.productUpdateReaction.findUnique({ where: { updateId_visitor: { updateId: u.id, visitor } } })
    : null;
  return {
    ...toHeader(u, page, locale),
    blocks: localizeUpdate(u, locale).blocks,
    reaction: (mine?.reaction as ReactionKind | undefined) ?? null,
    comment: mine?.comment ?? "",
  };
}

export const reactSchema = z.object({
  reaction: z.enum(reactionKinds).nullable(),
  comment: z.string().max(2000).optional(),
});

async function saveReaction(workspace: Workspace, updateId: string, visitor: string, input: z.infer<typeof reactSchema>) {
  if (!parseUpdatesPage(workspace.updatesPage).reactions) throw new SdkError("Reactions are off", 403);
  const u = await prisma.productUpdate.findFirst({ where: { id: updateId, ...publicWhere(workspace.id) }, select: { id: true } });
  if (!u) throw new SdkError("Update not found", 404);
  const where = { updateId_visitor: { updateId, visitor } };
  if (!input.reaction) {
    await prisma.productUpdateReaction.deleteMany({ where: { updateId, visitor } });
    return { ok: true };
  }
  const comment = input.comment === undefined ? undefined : input.comment.trim() || null;
  await prisma.productUpdateReaction.upsert({
    where,
    create: { updateId, workspaceId: workspace.id, visitor, reaction: input.reaction, comment: comment ?? null },
    update: { reaction: input.reaction, ...(comment !== undefined ? { comment } : {}) },
  });
  return { ok: true };
}

export async function sdkReact(input: {
  key: string;
  id: string;
  user: z.infer<typeof sdkVisitorSchema>;
  reaction: ReactionKind | null;
  comment?: string;
}) {
  const workspace = await prisma.workspace.findUnique({ where: { publicKey: input.key } });
  if (!workspace) throw new SdkError("Unknown workspace key", 404);
  const visitor = sdkVisitor(workspace, input.user);
  if (!visitor) throw new SdkError("id or anonymousId is required", 400);
  return saveReaction(workspace, input.id, visitor, input);
}

// ---------- Public page ----------

export async function workspaceBySlug(slug: string) {
  const workspace = await prisma.workspace.findUnique({ where: { updatesSlug: slug.toLowerCase().slice(0, 64) } });
  if (!workspace) return null;
  const page = parseUpdatesPage(workspace.updatesPage);
  return page.enabled ? { workspace, page } : null;
}

export async function pageReact(slug: string, id: string, visitorCookie: string, input: z.infer<typeof reactSchema>) {
  const found = await workspaceBySlug(slug);
  if (!found) throw new SdkError("Page not found", 404);
  return saveReaction(found.workspace, id, "p:" + visitorCookie, input);
}

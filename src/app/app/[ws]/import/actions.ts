"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import type { Block } from "@/lib/guide-schema";
import { parseUpdatesPage, SLUG_RE } from "@/lib/updates";
import { convertUserGuidingUpdates } from "@/lib/userguiding-updates";
import {
  convertUserGuiding,
  fetchUserGuidingData,
  imageUrls,
  parseContainerId,
  relinkGuides,
  type UgCandidate,
} from "@/lib/userguiding";

export type UgSource = { containerId?: string; json?: string };

export type UgPreview =
  | {
      ok: true;
      containerTitle: string;
      skipped: string[];
      hasTheme: boolean;
      items: {
        ugId: number;
        kind: UgCandidate["kind"];
        name: string;
        active: boolean;
        stepCount: number;
        trigger: string;
        warnings: string[];
        exists: boolean;
      }[];
      updates: {
        ugId: number;
        title: string;
        date: string;
        labels: string[];
        active: boolean;
        languages: number;
        warnings: string[];
        exists: boolean;
      }[];
      // UserGuiding's updates page header, when it has one.
      updatesPage: { title: string; hasLogo: boolean } | null;
    }
  | { ok: false; error: string };

async function load(source: UgSource) {
  if (source.json) {
    try {
      return JSON.parse(source.json);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
  }
  const id = parseContainerId(source.containerId ?? "");
  if (!id) throw new Error("Enter your UserGuiding container id, or paste your UserGuiding snippet.");
  return fetchUserGuidingData(id);
}

export async function previewUserGuiding(ws: string, source: UgSource): Promise<UgPreview> {
  await requireWorkspace(ws);
  try {
    const data = await load(source);
    const conv = convertUserGuiding(data);
    const upd = convertUserGuidingUpdates(data);
    if (!conv.candidates.length && !upd.updates.length)
      return { ok: false, error: "No guides, checklists or product updates found in that UserGuiding account." };
    const existing = new Set(
      (await prisma.guide.findMany({ where: { workspaceId: ws }, select: { name: true } })).map((g) => g.name),
    );
    const existingUpdates = new Set(
      (await prisma.productUpdate.findMany({ where: { workspaceId: ws }, select: { title: true } })).map((u) => u.title),
    );
    const labelName = new Map(upd.labels.map((l) => [l.id, l.name]));
    return {
      ok: true,
      containerTitle: conv.containerTitle,
      skipped: conv.skipped,
      hasTheme: Boolean(conv.theme),
      items: conv.candidates.map((c) => ({
        ugId: c.ugId,
        kind: c.kind,
        name: c.name,
        active: c.active,
        stepCount: c.stepCount,
        trigger: c.targeting.trigger,
        warnings: c.warnings,
        exists: existing.has(c.name),
      })),
      updates: upd.updates.map((u) => ({
        ugId: u.ugId,
        title: u.title,
        date: u.publishedAt.toISOString(),
        labels: u.labels.map((l) => labelName.get(l) ?? l),
        active: u.active,
        languages: 1 + Object.keys(u.translations).length,
        warnings: u.warnings,
        exists: existingUpdates.has(u.title),
      })),
      updatesPage: upd.page && (upd.page.title || upd.page.logoUrl) ? { title: upd.page.title, hasLogo: Boolean(upd.page.logoUrl) } : null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read UserGuiding data." };
  }
}

export type ImportOptions = {
  // "<kind>:<UserGuiding id>", e.g. "TOUR:123".
  ugIds: string[];
  copyImages: boolean;
  importTheme: boolean;
  anyDomain: boolean;
  publishActive: boolean;
  updateIds: number[];
  // Publish posts that are live in UserGuiding, with their original dates.
  publishUpdates: boolean;
  importUpdatesPage: boolean;
};

export type ImportResult =
  | {
      ok: true;
      created: { id: string; name: string; kind: string; warnings: string[] }[];
      updatesCreated: { id: string; title: string; warnings: string[] }[];
      imagesCopied: number;
      imagesFailed: number;
      themeImported: boolean;
      updatesPageImported: boolean;
    }
  | { ok: false; error: string };

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE = 5 * 1024 * 1024;

export async function importUserGuiding(ws: string, source: UgSource, opts: ImportOptions): Promise<ImportResult> {
  await requireWorkspace(ws);
  let conv: ReturnType<typeof convertUserGuiding>;
  let upd: ReturnType<typeof convertUserGuidingUpdates>;
  try {
    const data = await load(source);
    conv = convertUserGuiding(data, { anyDomain: opts.anyDomain });
    upd = convertUserGuidingUpdates(data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read UserGuiding data." };
  }
  const chosen = conv.candidates.filter((c) => opts.ugIds.includes(`${c.kind}:${c.ugId}`));
  const chosenUpdates = upd.updates.filter((u) => (opts.updateIds ?? []).includes(u.ugId));
  if (!chosen.length && !chosenUpdates.length && !opts.importUpdatesPage) return { ok: false, error: "Select at least one thing to import." };

  // 1. Copy images into our asset store, so guides survive cancelling UserGuiding.
  const imageMap = new Map<string, string>();
  let imagesFailed = 0;
  if (opts.copyImages) {
    const base = await appUrl();
    const blockImages = (blocks: Block[]) => blocks.flatMap((b) => (b.type === "image" && b.url ? [b.url] : []));
    const urls = [
      ...new Set([
        ...chosen.flatMap((c) => imageUrls(c.content)),
        ...chosenUpdates.flatMap((u) => [
          u.coverUrl,
          ...blockImages(u.content.blocks),
          ...Object.values(u.translations).flatMap((t) => blockImages(t.blocks)),
        ]),
        ...(opts.importUpdatesPage && upd.page?.logoUrl ? [upd.page.logoUrl] : []),
      ]),
    ].filter(Boolean);
    for (const url of urls) {
      try {
        const res = await fetch(url);
        const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
        if (!res.ok || !IMAGE_TYPES.has(type)) throw new Error(`${res.status} ${type}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_IMAGE) throw new Error("too large");
        const asset = await prisma.asset.create({ data: { workspaceId: ws, mimeType: type, size: buf.length, data: buf }, select: { id: true } });
        imageMap.set(url, `${base}/api/assets/${asset.id}`);
      } catch {
        // Keep the UserGuiding URL; it works while that account exists.
        imagesFailed++;
      }
    }
  }

  // 2. Create the guides (as drafts unless asked otherwise), then fix cross-references.
  const created: { id: string; name: string; kind: string; warnings: string[]; candidate: UgCandidate }[] = [];
  for (const c of chosen) {
    const content = opts.copyImages
      ? (JSON.parse(JSON.stringify(c.content), (k, v) => (k === "url" && typeof v === "string" && imageMap.has(v) ? imageMap.get(v) : v)) as typeof c.content)
      : c.content;
    const g = await prisma.guide.create({
      data: {
        workspaceId: ws,
        name: c.name,
        type: c.kind,
        content: content as Prisma.InputJsonObject,
        targeting: c.targeting as Prisma.InputJsonObject,
        priority: c.priority,
      },
      select: { id: true },
    });
    created.push({ id: g.id, name: c.name, kind: c.kind, warnings: [...c.warnings], candidate: { ...c, content } });
  }

  // Buttons and checklist items point at UserGuiding guides, i.e. our tours.
  const idMap = new Map(created.filter((x) => x.kind === "TOUR").map((x) => [String(x.candidate.ugId), x.id]));
  for (const x of created) {
    const warn = new Set<string>();
    const content = relinkGuides(x.candidate.content, idMap, (m) => warn.add(m));
    x.warnings.push(...warn);
    const publish = opts.publishActive && x.candidate.active;
    await prisma.guide.update({
      where: { id: x.id },
      data: {
        content: content as Prisma.InputJsonObject,
        ...(publish ? { status: "PUBLISHED", publishedContent: content as Prisma.InputJsonObject, publishedAt: new Date() } : {}),
      },
    });
  }

  // 3. Product updates: labels merged by name, posts as drafts or with their original dates.
  const swap = <T,>(v: T): T => (opts.copyImages ? (JSON.parse(JSON.stringify(v), (k, x) => (k === "url" && typeof x === "string" && imageMap.has(x) ? imageMap.get(x) : x)) as T) : v);
  const updatesCreated: { id: string; title: string; warnings: string[] }[] = [];
  let updatesPageImported = false;
  if (chosenUpdates.length || opts.importUpdatesPage) {
    const { workspace } = await requireWorkspace(ws);
    const page = parseUpdatesPage(workspace.updatesPage);
    const labelMap = new Map<string, string>();
    for (const l of upd.labels) {
      const same = page.labels.find((x) => x.name.trim().toLowerCase() === l.name.toLowerCase());
      if (same) labelMap.set(l.id, same.id);
      else if (page.labels.length < 20 && chosenUpdates.some((u) => u.labels.includes(l.id))) {
        page.labels.push(l);
        labelMap.set(l.id, l.id);
      }
    }
    let slug = workspace.updatesSlug;
    if (opts.importUpdatesPage && upd.page) {
      const p = upd.page;
      if (p.title) page.title = p.title;
      if (p.description) page.description = p.description;
      if (p.logoUrl) page.logoUrl = imageMap.get(p.logoUrl) ?? p.logoUrl;
      if (p.websiteUrl) {
        page.websiteUrl = p.websiteUrl;
        if (p.websiteLabel) page.websiteLabel = p.websiteLabel;
      }
      // Keep the UserGuiding address when it's free and none is set yet.
      if (!slug && p.slug && SLUG_RE.test(p.slug) && !(await prisma.workspace.findFirst({ where: { updatesSlug: p.slug }, select: { id: true } })))
        slug = p.slug;
      updatesPageImported = true;
    }
    await prisma.workspace.update({ where: { id: ws }, data: { updatesSlug: slug, updatesPage: page as unknown as Prisma.InputJsonObject } });

    for (const u of chosenUpdates) {
      const publish = opts.publishUpdates && u.active;
      const row = await prisma.productUpdate.create({
        data: {
          workspaceId: ws,
          title: u.title.slice(0, 255),
          content: swap(u.content) as unknown as Prisma.InputJsonObject,
          translations: swap(u.translations) as unknown as Prisma.InputJsonObject,
          coverUrl: (imageMap.get(u.coverUrl) ?? u.coverUrl) || null,
          labels: [...new Set(u.labels.map((l) => labelMap.get(l)).filter(Boolean))] as string[],
          status: publish ? "PUBLISHED" : "DRAFT",
          publishedAt: u.publishedAt,
        },
        select: { id: true },
      });
      updatesCreated.push({ id: row.id, title: u.title, warnings: u.warnings });
    }
  }

  // 4. Theme.
  let themeImported = false;
  if (opts.importTheme && conv.theme) {
    await prisma.workspace.update({ where: { id: ws }, data: { theme: conv.theme as Prisma.InputJsonObject } });
    themeImported = true;
  }

  revalidatePath(`/app/${ws}`, "layout");
  return {
    ok: true,
    created: created.map(({ id, name, kind, warnings }) => ({ id, name, kind, warnings })),
    updatesCreated,
    imagesCopied: imageMap.size,
    imagesFailed,
    themeImported,
    updatesPageImported,
  };
}

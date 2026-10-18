"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import type { ChecklistContent, TourContent } from "@/lib/guide-schema";
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
    const conv = convertUserGuiding(await load(source));
    if (!conv.candidates.length) return { ok: false, error: "No guides or checklists found in that UserGuiding account." };
    const existing = new Set(
      (await prisma.guide.findMany({ where: { workspaceId: ws }, select: { name: true } })).map((g) => g.name),
    );
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
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read UserGuiding data." };
  }
}

export type ImportOptions = {
  ugIds: number[];
  copyImages: boolean;
  importTheme: boolean;
  anyDomain: boolean;
  publishActive: boolean;
};

export type ImportResult =
  | { ok: true; created: { id: string; name: string; kind: string; warnings: string[] }[]; imagesCopied: number; imagesFailed: number; themeImported: boolean }
  | { ok: false; error: string };

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE = 5 * 1024 * 1024;

export async function importUserGuiding(ws: string, source: UgSource, opts: ImportOptions): Promise<ImportResult> {
  await requireWorkspace(ws);
  let conv: ReturnType<typeof convertUserGuiding>;
  try {
    conv = convertUserGuiding(await load(source), { anyDomain: opts.anyDomain });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read UserGuiding data." };
  }
  const chosen = conv.candidates.filter((c) => opts.ugIds.includes(c.ugId));
  if (!chosen.length) return { ok: false, error: "Select at least one guide to import." };

  // 1. Copy images into our asset store, so guides survive cancelling UserGuiding.
  const imageMap = new Map<string, string>();
  let imagesFailed = 0;
  if (opts.copyImages) {
    const base = await appUrl();
    const urls = [...new Set(chosen.flatMap((c) => imageUrls(c.content)))];
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

  const idMap = new Map(created.map((x) => [String(x.candidate.ugId), x.id]));
  for (const x of created) {
    const warn = new Set<string>();
    const content = relinkGuides(x.candidate.content as TourContent | ChecklistContent, idMap, (m) => warn.add(m));
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

  // 3. Theme.
  let themeImported = false;
  if (opts.importTheme && conv.theme) {
    await prisma.workspace.update({ where: { id: ws }, data: { theme: conv.theme as Prisma.InputJsonObject } });
    themeImported = true;
  }

  revalidatePath(`/app/${ws}`, "layout");
  return {
    ok: true,
    created: created.map(({ id, name, kind, warnings }) => ({ id, name, kind, warnings })),
    imagesCopied: imageMap.size,
    imagesFailed,
    themeImported,
  };
}

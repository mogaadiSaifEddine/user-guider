"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireGuide, requireWorkspace } from "@/lib/auth";
import { newPublicKey, newSecretKey } from "@/lib/keys";
import { signBuilderToken } from "@/lib/tokens";
import {
  contentSchemas,
  defaultContent,
  parseTargeting,
  targetingSchema,
  themeSchema,
  type GuideTypeName,
} from "@/lib/guide-schema";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// ---------- Guides ----------

const guideTypes = ["TOUR", "CHECKLIST", "ANNOUNCEMENT", "HOTSPOT"] as const;

export async function createGuide(ws: string, form: FormData) {
  await requireWorkspace(ws);
  const type = z.enum(guideTypes).parse(form.get("type"));
  const name = z.string().trim().min(1).max(191).catch("Untitled guide").parse(form.get("name"));
  const guide = await prisma.guide.create({
    data: {
      workspaceId: ws,
      name,
      type,
      content: defaultContent(type) as Prisma.InputJsonObject,
      targeting: parseTargeting({}) as Prisma.InputJsonObject,
    },
  });
  redirect(`/app/${ws}/guides/${guide.id}`);
}

const saveSchema = z.object({
  name: z.string().trim().min(1).max(191),
  priority: z.number().int().min(-100).max(100),
  content: z.unknown(),
  targeting: targetingSchema,
});

export async function saveGuide(ws: string, id: string, input: unknown): Promise<ActionResult> {
  const { guide } = await requireGuide(ws, id);
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const content = contentSchemas[guide.type as GuideTypeName].safeParse(parsed.data.content);
  if (!content.success) return { ok: false, error: describe(content.error) };

  await prisma.guide.update({
    where: { id },
    data: {
      name: parsed.data.name,
      priority: parsed.data.priority,
      content: content.data as Prisma.InputJsonObject,
      targeting: parsed.data.targeting as Prisma.InputJsonObject,
    },
  });
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true };
}

export async function publishGuide(ws: string, id: string): Promise<ActionResult> {
  const { guide } = await requireGuide(ws, id);
  const content = contentSchemas[guide.type as GuideTypeName].safeParse(guide.content);
  if (!content.success) return { ok: false, error: describe(content.error) };
  const problem = publishProblem(guide.type as GuideTypeName, content.data);
  if (problem) return { ok: false, error: problem };

  await prisma.guide.update({
    where: { id },
    data: { status: "PUBLISHED", publishedContent: content.data as Prisma.InputJsonObject, publishedAt: new Date() },
  });
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true, message: "Published. Live on your site within a page load." };
}

function publishProblem(type: GuideTypeName, content: unknown): string | null {
  const c = content as Record<string, unknown[]>;
  if (type === "TOUR" && !c.steps.length) return "Add at least one step before publishing.";
  if (type === "CHECKLIST" && !c.items.length) return "Add at least one item before publishing.";
  if (type === "HOTSPOT") {
    const hs = c.hotspots as { selector: string }[];
    if (!hs.length) return "Add at least one hotspot before publishing.";
    if (hs.some((h) => !h.selector)) return "Every hotspot needs an element. Pick one in the builder.";
  }
  return null;
}

export async function setGuideStatus(ws: string, id: string, status: "DRAFT" | "ARCHIVED"): Promise<ActionResult> {
  await requireGuide(ws, id);
  await prisma.guide.update({ where: { id }, data: { status } });
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true, message: status === "DRAFT" ? "Unpublished." : "Archived." };
}

export async function duplicateGuide(ws: string, id: string) {
  const { guide } = await requireGuide(ws, id);
  const copy = await prisma.guide.create({
    data: {
      workspaceId: ws,
      name: `${guide.name} (copy)`.slice(0, 191),
      type: guide.type,
      content: guide.content as Prisma.InputJsonObject,
      targeting: guide.targeting as Prisma.InputJsonObject,
      priority: guide.priority,
    },
  });
  redirect(`/app/${ws}/guides/${copy.id}`);
}

export async function deleteGuide(ws: string, id: string) {
  await requireGuide(ws, id);
  await prisma.guide.delete({ where: { id } });
  revalidatePath(`/app/${ws}/guides`);
  redirect(`/app/${ws}/guides`);
}

// Link that opens the customer's site in builder mode for this guide.
export async function builderLink(
  ws: string,
  id: string,
  pageUrl: string,
  aiGoal: string | null = null,
): Promise<ActionResult & { url?: string }> {
  const { user } = await requireGuide(ws, id);
  let url: URL;
  try {
    url = new URL(pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, error: "Enter the full address of a page on your site, starting with https://" };
  }
  const goal = aiGoal === null ? null : aiGoal.trim().slice(0, 1000);
  url.searchParams.set("lg_builder", await signBuilderToken({ userId: user.id, workspaceId: ws, guideId: id, aiGoal: goal }));
  return { ok: true, url: url.toString() };
}

// ---------- Workspace settings ----------

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  requireIdentityVerification: z.boolean(),
  theme: themeSchema,
});

export async function updateWorkspace(ws: string, input: unknown): Promise<ActionResult> {
  await requireWorkspace(ws);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  await prisma.workspace.update({
    where: { id: ws },
    data: {
      name: parsed.data.name,
      requireIdentityVerification: parsed.data.requireIdentityVerification,
      theme: parsed.data.theme as Prisma.InputJsonObject,
    },
  });
  revalidatePath(`/app/${ws}`, "layout");
  return { ok: true, message: "Saved." };
}

export async function rotateKey(ws: string, which: "public" | "secret"): Promise<ActionResult> {
  const { role } = await requireWorkspace(ws);
  if (role !== "OWNER") return { ok: false, error: "Only owners can rotate keys." };
  await prisma.workspace.update({
    where: { id: ws },
    data: which === "public" ? { publicKey: newPublicKey() } : { secretKey: newSecretKey() },
  });
  revalidatePath(`/app/${ws}`, "layout");
  return {
    ok: true,
    message: which === "public" ? "New public key. Update the snippet on your site." : "New secret key. Update your server.",
  };
}

export async function addMember(ws: string, email: string, role: "OWNER" | "EDITOR"): Promise<ActionResult> {
  const ctx = await requireWorkspace(ws);
  if (ctx.role !== "OWNER") return { ok: false, error: "Only owners can add members." };
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, error: "No account with that email. Ask them to sign up first." };
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ws } },
    create: { userId: user.id, workspaceId: ws, role },
    update: { role },
  });
  revalidatePath(`/app/${ws}/settings`);
  return { ok: true, message: `${user.name} added.` };
}

export async function removeMember(ws: string, userId: string): Promise<ActionResult> {
  const ctx = await requireWorkspace(ws);
  if (ctx.role !== "OWNER") return { ok: false, error: "Only owners can remove members." };
  const owners = await prisma.membership.count({ where: { workspaceId: ws, role: "OWNER" } });
  const target = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId: ws } } });
  if (!target) return { ok: false, error: "Not a member." };
  if (target.role === "OWNER" && owners <= 1) return { ok: false, error: "A workspace needs at least one owner." };
  await prisma.membership.delete({ where: { userId_workspaceId: { userId, workspaceId: ws } } });
  revalidatePath(`/app/${ws}/settings`);
  return { ok: true };
}

export async function deleteWorkspace(ws: string, confirmName: string): Promise<ActionResult> {
  const { role, workspace } = await requireWorkspace(ws);
  if (role !== "OWNER") return { ok: false, error: "Only owners can delete a workspace." };
  if (confirmName.trim() !== workspace.name) return { ok: false, error: "Type the workspace name to confirm." };
  await prisma.workspace.delete({ where: { id: ws } });
  redirect("/app?all=1");
}

function describe(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input";
}

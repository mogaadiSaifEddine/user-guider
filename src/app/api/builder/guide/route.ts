import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { json, preflight } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { verifyBuilderToken } from "@/lib/tokens";
import { contentSchemas, parseContent, type GuideTypeName } from "@/lib/guide-schema";
import { aiEnabled } from "@/lib/ai";

// Used by the SDK's builder mode on the customer's site. Auth is the bearer
// builder token minted from the dashboard, never a cookie.

export const OPTIONS = preflight;

async function load(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const claims = await verifyBuilderToken(token);
  if (!claims) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: claims.userId, workspaceId: claims.workspaceId } },
  });
  if (!membership) return null;
  const guide = await prisma.guide.findFirst({ where: { id: claims.guideId, workspaceId: claims.workspaceId } });
  return guide ? Object.assign(guide, { claims }) : null;
}

export async function GET(req: Request) {
  const guide = await load(req);
  if (!guide) return json({ error: "Builder session expired. Reopen the builder from the dashboard." }, 401);
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: guide.workspaceId } });
  return json({
    id: guide.id,
    name: guide.name,
    type: guide.type,
    status: guide.status,
    content: parseContent(guide.type as GuideTypeName, guide.content),
    theme: workspace.theme,
    ai: { enabled: aiEnabled(), autoGoal: aiEnabled() ? guide.claims.aiGoal : null },
  });
}

const putSchema = z.object({ content: z.unknown() });

export async function PUT(req: Request) {
  const guide = await load(req);
  if (!guide) return json({ error: "Builder session expired. Reopen the builder from the dashboard." }, 401);
  const body = putSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid request" }, 400);
  const content = contentSchemas[guide.type as GuideTypeName].safeParse(body.data.content);
  if (!content.success) return json({ error: "Invalid content" }, 400);
  await prisma.guide.update({
    where: { id: guide.id },
    data: { content: content.data as Prisma.InputJsonObject },
  });
  return json({ ok: true });
}

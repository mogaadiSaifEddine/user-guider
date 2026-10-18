import { json, preflight } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { verifyBuilderToken } from "@/lib/tokens";
import { AiError, draftGuide, generateSchema } from "@/lib/ai";

// Drafts tour steps or hotspots for the guide open in builder mode. Returns
// the draft only; the builder shows it for review and saves it like a manual edit.

export const OPTIONS = preflight;
export const maxDuration = 60;

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const claims = await verifyBuilderToken(token);
  if (!claims) return json({ error: "Builder session expired. Reopen the builder from the dashboard." }, 401);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: claims.userId, workspaceId: claims.workspaceId } },
  });
  if (!membership) return json({ error: "You're no longer a member of this workspace." }, 401);

  const parsed = generateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);

  try {
    return json({ items: await draftGuide(parsed.data) });
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    throw e;
  }
}

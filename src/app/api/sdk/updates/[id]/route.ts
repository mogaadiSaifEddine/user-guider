import { z } from "zod";
import { json, preflight } from "@/lib/cors";
import { SdkError } from "@/lib/sdk-service";
import { reactSchema, sdkReact, sdkUpdate, sdkVisitorSchema } from "@/lib/updates-service";

export const OPTIONS = preflight;

const handle = async <T>(fn: () => Promise<T>) => {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof SdkError) return json({ error: e.message }, e.status);
    throw e;
  }
};

// GET /api/sdk/updates/<id>?key=…&locale=de&uid=…|aid=…&hash=…
// The reader's ids only fetch their own reaction.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = new URL(req.url).searchParams;
  const key = p.get("key");
  if (!key) return json({ error: "Missing key" }, 400);
  const user = sdkVisitorSchema.safeParse({
    id: p.get("uid") || undefined,
    anonymousId: p.get("aid") || undefined,
    hash: p.get("hash") || undefined,
  });
  return handle(() => sdkUpdate({ key: key.slice(0, 100), locale: p.get("locale"), id: id.slice(0, 64), user: user.success ? user.data : null }));
}

const postSchema = reactSchema.extend({ key: z.string().min(1).max(100), user: sdkVisitorSchema });

// POST /api/sdk/updates/<id> { key, user, reaction: "love" | "neutral" | "sad" | null, comment? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text().then((t) => JSON.parse(t)).catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  return handle(() => sdkReact({ ...parsed.data, id: id.slice(0, 64) }));
}

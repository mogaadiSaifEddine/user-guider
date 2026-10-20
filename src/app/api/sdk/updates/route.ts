import { json, preflight } from "@/lib/cors";
import { SdkError } from "@/lib/sdk-service";
import { sdkUpdatesList } from "@/lib/updates-service";

export const OPTIONS = preflight;

// GET /api/sdk/updates?key=…&locale=de&limit=5
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const key = p.get("key");
  if (!key) return json({ error: "Missing key" }, 400);
  const limit = Math.min(Math.max(Number(p.get("limit")) || 10, 1), 50);
  try {
    return json(await sdkUpdatesList({ key: key.slice(0, 100), locale: p.get("locale"), limit }));
  } catch (e) {
    if (e instanceof SdkError) return json({ error: e.message }, e.status);
    throw e;
  }
}

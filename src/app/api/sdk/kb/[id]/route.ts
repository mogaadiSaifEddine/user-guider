import { json, preflight } from "@/lib/cors";
import { SdkError } from "@/lib/sdk-service";
import { sdkKbArticle } from "@/lib/kb-service";

export const OPTIONS = preflight;

// GET /api/sdk/kb/<articleId>?key=…&locale=de
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = new URL(req.url).searchParams;
  const key = p.get("key");
  if (!key) return json({ error: "Missing key" }, 400);
  try {
    return json(await sdkKbArticle({ key: key.slice(0, 100), locale: p.get("locale"), id: id.slice(0, 64) }));
  } catch (e) {
    if (e instanceof SdkError) return json({ error: e.message }, e.status);
    throw e;
  }
}

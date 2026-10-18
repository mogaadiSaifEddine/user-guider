import { json, preflight } from "@/lib/cors";
import { SdkError } from "@/lib/sdk-service";
import { sdkKbList } from "@/lib/kb-service";

export const OPTIONS = preflight;

// GET /api/sdk/kb?key=…&locale=de&collections=a,b&q=invoice
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const key = p.get("key");
  if (!key) return json({ error: "Missing key" }, 400);
  try {
    return json(
      await sdkKbList({
        key: key.slice(0, 100),
        locale: p.get("locale"),
        collections: (p.get("collections") ?? "").split(",").filter(Boolean).slice(0, 50),
        q: (p.get("q") ?? "").slice(0, 100),
      }),
    );
  } catch (e) {
    if (e instanceof SdkError) return json({ error: e.message }, e.status);
    throw e;
  }
}

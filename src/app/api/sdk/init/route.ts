import { json, preflight } from "@/lib/cors";
import { initSchema, sdkInit, SdkError } from "@/lib/sdk-service";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const parsed = initSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  try {
    return json(await sdkInit(parsed.data));
  } catch (e) {
    if (e instanceof SdkError) return json({ error: e.message }, e.status);
    throw e;
  }
}

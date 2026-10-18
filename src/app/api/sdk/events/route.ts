import { json, preflight } from "@/lib/cors";
import { eventsSchema, sdkEvents, SdkError } from "@/lib/sdk-service";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  // sendBeacon posts text/plain, so parse the body by hand.
  const body = await req.text().then((t) => JSON.parse(t)).catch(() => null);
  const parsed = eventsSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  try {
    return json(await sdkEvents(parsed.data));
  } catch (e) {
    if (e instanceof SdkError) return json({ error: e.message }, e.status);
    throw e;
  }
}

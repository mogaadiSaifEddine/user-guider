import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SdkError } from "@/lib/sdk-service";
import { pageReact, reactSchema } from "@/lib/updates-service";

// POST /updates/<slug>/react { id, reaction, comment? } from the public page.
// Readers are anonymous; a cookie keeps one reaction per browser and post.

const COOKIE = "uo_reader";
const bodySchema = reactSchema.extend({ id: z.string().min(1).max(64) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const jar = await cookies();
  let reader = jar.get(COOKIE)?.value ?? "";
  const fresh = !/^[a-f0-9]{32}$/.test(reader);
  if (fresh) reader = randomBytes(16).toString("hex");
  try {
    const res = NextResponse.json(await pageReact(slug, parsed.data.id, reader, parsed.data));
    if (fresh) res.cookies.set(COOKIE, reader, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 730, path: "/updates" });
    return res;
  } catch (e) {
    if (e instanceof SdkError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";

// Image and audio upload for guide content (dashboard only, session cookie auth).
// SVG is refused: served from our origin it could run script when opened directly.

const IMAGE_MAX = 2 * 1024 * 1024;
const AUDIO_MAX = 10 * 1024 * 1024;
const IMAGES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const AUDIO = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const workspaceId = String(form?.get("workspaceId") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });

  const member = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId } } });
  if (!member) return NextResponse.json({ error: "Not a member of this workspace." }, { status: 403 });
  const audio = AUDIO.has(file.type);
  if (!audio && !IMAGES.has(file.type))
    return NextResponse.json({ error: "Use a PNG, JPEG, GIF or WebP image, or an MP3, M4A, OGG, WAV or WebM audio file." }, { status: 415 });
  if (file.size > (audio ? AUDIO_MAX : IMAGE_MAX))
    return NextResponse.json({ error: audio ? "Audio files can be up to 10 MB." : "Images can be up to 2 MB." }, { status: 413 });

  const asset = await prisma.asset.create({
    data: { workspaceId, mimeType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) },
    select: { id: true },
  });
  return NextResponse.json({ url: `${await appUrl()}/api/assets/${asset.id}` });
}

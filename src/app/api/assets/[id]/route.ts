import { prisma } from "@/lib/db";

// Public: guide images and audio are shown on customer sites. Assets never change, so cache hard.
// Single byte ranges are served too, so audio players can seek.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id }, select: { mimeType: true, data: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Accept-Ranges": "bytes",
  };
  const bytes = new Uint8Array(asset.data);
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    const size = bytes.length;
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    return new Response(bytes.subarray(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(bytes, { headers });
}

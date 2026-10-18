import { requireWorkspace } from "@/lib/auth";
import { userWhere } from "@/lib/audience";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/survey-results";
import { parseUserFilters } from "../filters";

const MAX_ROWS = 100_000;

// CSV of the Users list with the same filters as the page.
export async function GET(req: Request, { params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  await requireWorkspace(ws);
  const filters = parseUserFilters(Object.fromEntries(new URL(req.url).searchParams));
  const users = await prisma.endUser.findMany({
    where: userWhere(ws, filters),
    orderBy: { lastSeenAt: "desc" },
    take: MAX_ROWS,
  });
  const rows = [
    ["User", "Anonymous", "Company ID", "Company", "Browser", "OS", "Device", "Language", "Time zone", "First seen", "Last seen", "Attributes"],
    ...users.map((u) => [
      u.anonymous ? u.externalId.replace(/^anon:/, "") : u.externalId,
      u.anonymous ? "yes" : "no",
      u.companyId ?? "",
      u.companyName ?? "",
      u.browser ?? "",
      u.os ?? "",
      u.device ?? "",
      u.language ?? "",
      u.timezone ?? "",
      u.firstSeenAt.toISOString(),
      u.lastSeenAt.toISOString(),
      JSON.stringify(u.attributes),
    ]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Button, Card, Input } from "@/components/ui";
import { logout } from "../(auth)/actions";
import { createWorkspace } from "./actions";

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await requireUser();
  const { all } = await searchParams;
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { include: { _count: { select: { guides: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  // Straight into the only workspace, unless the user asked to see the list.
  if (memberships.length === 1 && !all) redirect(`/app/${memberships[0].workspaceId}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{memberships.length ? "Your workspaces" : "Create your first workspace"}</h1>
        <form action={logout}>
          <Button variant="ghost">Sign out</Button>
        </form>
      </div>

      {memberships.length > 0 && (
        <Card className="mb-8 divide-y divide-gray-100">
          {memberships.map((m) => (
            <Link
              key={m.workspaceId}
              href={`/app/${m.workspaceId}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{m.workspace.name}</div>
                <div className="text-xs text-gray-500">
                  {m.workspace._count.guides} guides · {m.role.toLowerCase()}
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          ))}
        </Card>
      )}

      <Card className="p-5">
        <form action={createWorkspace} className="flex gap-2">
          <Input name="name" placeholder="Workspace name, e.g. Locatify CMS" required maxLength={100} />
          <Button>Create</Button>
        </form>
        <p className="mt-2 text-xs text-gray-500">
          A workspace is one website or app. It gets its own embed snippet, guides and analytics.
        </p>
      </Card>
    </div>
  );
}

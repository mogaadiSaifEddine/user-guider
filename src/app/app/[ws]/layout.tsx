import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { Button } from "@/components/ui";
import { FeedbackProvider } from "@/components/feedback";
import { logout } from "../../(auth)/actions";
import { NavLinks } from "./nav-links";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ ws: string }>;
}) {
  const { ws } = await params;
  const { workspace, user } = await requireWorkspace(ws);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-gray-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">L</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{workspace.name}</div>
            <Link href="/app?all=1" className="text-xs text-gray-500 hover:text-gray-700">
              Switch workspace
            </Link>
          </div>
        </div>
        <NavLinks ws={ws} />
        <a
          href="/docs"
          target="_blank"
          className="mx-2 mb-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 md:mb-0"
        >
          Docs ↗
        </a>
        <div className="mt-auto hidden border-t border-gray-100 px-4 py-3 md:block">
          <div className="truncate text-xs text-gray-500">{user.email}</div>
          <form action={logout}>
            <Button variant="ghost" className="-ml-3 mt-1 px-3 text-xs">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
          <FeedbackProvider>{children}</FeedbackProvider>
        </div>
      </main>
    </div>
  );
}

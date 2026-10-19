import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
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
      <aside className="flex shrink-0 flex-col bg-gray-950 text-gray-300 md:sticky md:top-0 md:h-screen md:w-60">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-400 to-brand-700 text-sm font-extrabold text-white shadow-brand">U</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{workspace.name}</div>
            <Link href="/app?all=1" className="text-xs text-gray-400 hover:text-white">
              Switch workspace
            </Link>
          </div>
        </div>
        <NavLinks ws={ws} />
        <a
          href="/docs"
          target="_blank"
          className="mx-2 mb-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white md:mb-0"
        >
          Docs ↗
        </a>
        <div className="mt-auto hidden border-t border-white/10 px-4 py-3 md:block">
          <div className="truncate text-xs text-gray-400">{user.email}</div>
          <form action={logout}>
            <button className="-ml-2 mt-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white">
              Sign out
            </button>
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

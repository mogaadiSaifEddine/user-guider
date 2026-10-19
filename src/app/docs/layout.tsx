import Link from "next/link";
import type { Metadata } from "next";
import { docSections } from "@/lib/docs";
import { DocsNav } from "./docs-nav";

export const metadata: Metadata = {
  title: { template: "%s · User Onboarder docs", default: "User Onboarder docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/docs" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-brand-400 to-brand-700 text-sm font-extrabold text-white">U</span>
            User Onboarder <span className="font-normal text-gray-500">docs</span>
          </Link>
          <Link href="/app" className="ml-auto rounded-md px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50">
            Dashboard →
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
        <DocsNav sections={docSections.map((s) => ({ title: s.title, pages: s.pages.map((p) => ({ slug: p.slug, title: p.title })) }))} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

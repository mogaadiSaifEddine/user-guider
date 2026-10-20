import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserGuidingImport } from "./userguiding-import";

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { ws } = await params;
  const fromUpdates = (await searchParams).from === "updates";
  await requireWorkspace(ws);
  return (
    <>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/${fromUpdates ? "updates" : "guides"}`} className="text-gray-500 hover:text-gray-800">
          ← {fromUpdates ? "Product updates" : "Guides"}
        </Link>
      </div>
      <PageHeader
        title="Import from UserGuiding"
        description={
          <>
            Copies your UserGuiding guides, checklists and product updates into this workspace. Your UserGuiding account isn&apos;t changed.{" "}
            <a href="/docs/import-userguiding" target="_blank" className="font-medium text-brand-600 hover:underline">
              How it works
            </a>
          </>
        }
      />
      <UserGuidingImport ws={ws} onlyUpdates={fromUpdates} />
    </>
  );
}

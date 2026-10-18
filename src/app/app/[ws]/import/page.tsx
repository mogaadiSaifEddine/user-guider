import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserGuidingImport } from "./userguiding-import";

export default async function ImportPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  await requireWorkspace(ws);
  return (
    <>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/guides`} className="text-gray-500 hover:text-gray-800">
          ← Guides
        </Link>
      </div>
      <PageHeader
        title="Import from UserGuiding"
        description={
          <>
            Copies your UserGuiding guides and checklists into this workspace as drafts. Your UserGuiding account isn&apos;t changed.{" "}
            <a href="/docs/import-userguiding" target="_blank" className="font-medium text-indigo-600 hover:underline">
              How it works
            </a>
          </>
        }
      />
      <UserGuidingImport ws={ws} />
    </>
  );
}

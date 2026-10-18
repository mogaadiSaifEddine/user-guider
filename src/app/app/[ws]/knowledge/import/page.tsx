import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { languageName, workspaceLanguages } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { KbImport } from "./kb-import-form";

export default async function KbImportPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace } = await requireWorkspace(ws);
  const languages = workspaceLanguages(workspace.languages);
  return (
    <>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/knowledge`} className="text-gray-500 hover:text-gray-800">
          ← Knowledge base
        </Link>
      </div>
      <PageHeader
        title="Import help articles"
        description={
          <>
            Copies your Zendesk or Intercom help center into this knowledge base, with its collections and translations. Nothing changes on
            their side. Importing again updates the same articles.{" "}
            <a href="/docs/knowledge-base#import-from-zendesk-or-intercom" target="_blank" className="font-medium text-indigo-600 hover:underline">
              How it works
            </a>
          </>
        }
      />
      <KbImport ws={ws} languages={languages.map((l) => ({ code: l, name: languageName(l) }))} />
    </>
  );
}

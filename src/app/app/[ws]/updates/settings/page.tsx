import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { parseTheme } from "@/lib/guide-schema";
import { parseUpdatesPage, slugify } from "@/lib/updates";
import { PageHeader } from "@/components/ui";
import { UpdatesSettingsForm } from "./settings-form";

export default async function UpdatesSettingsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace } = await requireWorkspace(ws);

  return (
    <>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/updates`} className="text-gray-500 hover:text-gray-800">
          ← Product updates
        </Link>
      </div>
      <PageHeader title="Updates page settings" description="Your public changelog page, its branding and labels." />
      <UpdatesSettingsForm
        ws={ws}
        base={`${await appUrl()}/updates/`}
        slug={workspace.updatesSlug ?? ""}
        suggestedSlug={slugify(workspace.name) || "updates"}
        page={parseUpdatesPage(workspace.updatesPage)}
        accent={parseTheme(workspace.theme).primaryColor}
      />
    </>
  );
}

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { parseTheme } from "@/lib/guide-schema";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { SettingsForms } from "./settings-forms";
import { LANGUAGES, workspaceLanguages } from "@/lib/i18n";
import { builtinUi, hasBuiltinUi } from "@/lib/ui-strings-builtin";
import type { UiStrings } from "@/lib/ui-strings";

export default async function SettingsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace, role, user } = await requireWorkspace(ws);
  const members = await prisma.membership.findMany({
    where: { workspaceId: ws },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const languages = workspaceLanguages(workspace.languages).slice(1);
  const builtins = Object.fromEntries(
    [...new Set([...LANGUAGES.map((l) => l.code), ...languages])].map((code) => [code, { code, builtin: builtinUi(code), hasBuiltin: hasBuiltinUi(code) }]),
  );

  return (
    <>
      <PageHeader title="Settings" description={workspace.name} />
      <SettingsForms
        ws={ws}
        isOwner={role === "OWNER"}
        currentUserId={user.id}
        workspace={{
          name: workspace.name,
          publicKey: workspace.publicKey,
          // Only owners see the secret.
          secretKey: role === "OWNER" ? workspace.secretKey : null,
          requireIdentityVerification: workspace.requireIdentityVerification,
          aiContext: workspace.aiContext ?? "",
          companyIdAttribute: workspace.companyIdAttribute ?? "",
          companyNameAttribute: workspace.companyNameAttribute ?? "",
          theme: parseTheme(workspace.theme),
        }}
        aiEnabled={aiEnabled()}
        i18n={{ languages, uiStrings: (workspace.uiStrings ?? {}) as Record<string, Partial<UiStrings>>, builtins }}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role }))}
      />
    </>
  );
}

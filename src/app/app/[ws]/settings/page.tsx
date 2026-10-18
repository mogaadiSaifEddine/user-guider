import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { parseTheme } from "@/lib/guide-schema";
import { PageHeader } from "@/components/ui";
import { SettingsForms } from "./settings-forms";

export default async function SettingsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace, role, user } = await requireWorkspace(ws);
  const members = await prisma.membership.findMany({
    where: { workspaceId: ws },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

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
          theme: parseTheme(workspace.theme),
        }}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role }))}
      />
    </>
  );
}

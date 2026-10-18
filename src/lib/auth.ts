import "server-only";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "./tokens";

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const userId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/expired");
  return user;
}

// Loads a workspace the current user belongs to, or 404s.
export const requireWorkspace = cache(async (workspaceId: string) => {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    include: { workspace: true },
  });
  if (!membership) notFound();
  return { user, workspace: membership.workspace, role: membership.role };
});

export async function requireGuide(workspaceId: string, guideId: string) {
  const ctx = await requireWorkspace(workspaceId);
  const guide = await prisma.guide.findFirst({ where: { id: guideId, workspaceId } });
  if (!guide) notFound();
  return { ...ctx, guide };
}

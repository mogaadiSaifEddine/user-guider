"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { newPublicKey, newSecretKey } from "@/lib/keys";
import { parseTheme } from "@/lib/guide-schema";

export async function createWorkspace(form: FormData) {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(100).catch("My workspace").parse(form.get("name"));
  const workspace = await prisma.workspace.create({
    data: {
      name,
      publicKey: newPublicKey(),
      secretKey: newSecretKey(),
      theme: parseTheme({}),
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  redirect(`/app/${workspace.id}/install`);
}

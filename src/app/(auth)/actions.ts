"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startSession, endSession } from "@/lib/auth";

export type AuthState = { error?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: "An account with this email already exists" };
  const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  await startSession(user.id);
  redirect("/app");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
  next: z.string().optional(),
});

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password" };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Wrong email or password" };
  }
  await startSession(user.id);
  const next = parsed.data.next;
  redirect(next && next.startsWith("/app") ? next : "/app");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

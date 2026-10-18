import { SignJWT, jwtVerify } from "jose";

// Edge-safe (used by middleware): no Prisma or Node-only imports here.

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export const SESSION_COOKIE = "lg_session";
export const SESSION_DAYS = 30;

export async function signSession(userId: string) {
  return new SignJWT({ scope: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.scope === "session" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export type BuilderClaims = {
  userId: string;
  workspaceId: string;
  guideId: string;
  // Set when the builder should draft steps with AI as soon as it opens ("" = no goal).
  aiGoal?: string | null;
};

// Short-lived token that lets the SDK's builder mode edit one guide.
export async function signBuilderToken(c: BuilderClaims) {
  return new SignJWT({ scope: "builder", ws: c.workspaceId, guide: c.guideId, ai: c.aiGoal ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.userId)
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(secret());
}

export async function verifyBuilderToken(token: string | undefined | null): Promise<BuilderClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.scope !== "builder" || !payload.sub) return null;
    return {
      userId: payload.sub,
      workspaceId: String(payload.ws),
      guideId: String(payload.guide),
      aiGoal: typeof payload.ai === "string" ? payload.ai : null,
    };
  } catch {
    return null;
  }
}

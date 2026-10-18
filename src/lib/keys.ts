import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export function newPublicKey() {
  return "pk_" + randomBytes(12).toString("hex");
}

export function newSecretKey() {
  return "sk_" + randomBytes(24).toString("hex");
}

// What the host site's backend computes and passes as `hash` to identify().
export function userHash(secretKey: string, userId: string) {
  return createHmac("sha256", secretKey).update(userId).digest("hex");
}

export function verifyUserHash(secretKey: string, userId: string, hash: string | undefined) {
  if (!hash) return false;
  const expected = Buffer.from(userHash(secretKey, userId));
  const given = Buffer.from(hash);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

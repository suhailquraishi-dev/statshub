import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getUser } from "@/lib/store/store";
import type { User } from "@/lib/store/types";

/**
 * Prototype session: a signed user-id cookie. A production build reuses ES
 * identity or a managed auth provider (PRD §10-11).
 */
export const SESSION_COOKIE = "fp_session";
const g = globalThis as unknown as { __fpSecret?: string };
function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!g.__fpSecret) g.__fpSecret = randomBytes(32).toString("hex");
  return g.__fpSecret;
}

function sign(v: string) {
  return createHmac("sha256", secret()).update(v).digest("base64url");
}

export function sealSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function openSession(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const id = token.slice(0, i);
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return getUser(openSession(jar.get(SESSION_COOKIE)?.value));
}

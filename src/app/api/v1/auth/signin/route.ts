import { body, handle, ok } from "@/lib/server/api";
import { SESSION_COOKIE, sealSession } from "@/lib/server/session";
import { signIn } from "@/lib/store/store";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ email: string; displayName: string }>(req);
    const u = signIn(String(b.email ?? ""), String(b.displayName ?? ""));
    const res = ok({ user: { id: u.id, displayName: u.displayName, role: u.role } });
    res.cookies.set(SESSION_COOKIE, sealSession(u.id), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 });
    return res;
  });
}

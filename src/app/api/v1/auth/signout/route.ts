import { handle, ok } from "@/lib/server/api";
import { SESSION_COOKIE } from "@/lib/server/session";

export async function POST() {
  return handle(() => {
    const res = ok({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  });
}

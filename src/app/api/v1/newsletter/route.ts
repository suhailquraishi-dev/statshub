import { body, handle, ok } from "@/lib/server/api";
import { newsletterSignup } from "@/lib/store/store";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ email: string }>(req);
    newsletterSignup(String(b.email ?? ""));
    return ok({ ok: true }, { status: 201 });
  });
}

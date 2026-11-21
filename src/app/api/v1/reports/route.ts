import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { report } from "@/lib/store/store";

export async function POST(req: Request) {
  return handle(async () => {
    const me = await currentUser();
    const b = await body<{ commentId: string; reason: string }>(req);
    const r = report(me?.id ?? null, String(b.commentId ?? ""), String(b.reason ?? ""));
    return ok({ reportId: r.id }, { status: 201 });
  });
}

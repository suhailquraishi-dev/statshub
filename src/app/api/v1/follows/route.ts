import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { toggleFollow } from "@/lib/store/store";

export async function POST(req: Request) {
  return handle(async () => {
    const me = await currentUser();
    const b = await body<{ discussionId: string }>(req);
    return ok({ following: toggleFollow(me?.id ?? null, String(b.discussionId ?? "")) });
  });
}

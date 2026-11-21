import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { toggleReaction } from "@/lib/store/store";
import type { ReactionType } from "@/lib/store/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    const b = await body<{ type: ReactionType }>(req);
    return ok({ comment: toggleReaction(me?.id ?? null, id, b.type) });
  });
}

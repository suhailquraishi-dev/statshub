import { handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { FanPulseError, getDiscussion, isFollowing, listComments, pollResults } from "@/lib/store/store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    const d = getDiscussion(id);
    if (!d || d.status === "pending" || d.status === "archived") throw new FanPulseError("not_found", "Discussion not found.");
    const s = new URL(req.url).searchParams.get("sort");
    const sort = s === "oldest" || s === "top" ? s : "newest";
    return ok({ discussion: d, poll: pollResults(id, me?.id), comments: listComments(id, me?.id, sort), following: isFollowing(me?.id, id) });
  });
}

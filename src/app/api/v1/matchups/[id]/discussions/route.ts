import { handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { discussionCards } from "@/lib/server/view";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    return ok({ discussions: discussionCards({ gameId: id, viewerId: me?.id }).map((c) => ({ ...c.discussion, comments: c.comments, poll: c.poll })) });
  });
}

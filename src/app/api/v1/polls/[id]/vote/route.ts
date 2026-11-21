import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { FanPulseError, vote } from "@/lib/store/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!id.startsWith("poll_")) throw new FanPulseError("not_found", "Poll not found.");
    const me = await currentUser();
    const b = await body<{ optionId: string }>(req);
    return ok({ poll: vote(me?.id ?? null, id.slice(5), String(b.optionId ?? "")) });
  });
}

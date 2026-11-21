import { ensureStats } from "@/lib/data/provider";
import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { createDiscussion } from "@/lib/store/store";

export async function POST(req: Request) {
  return handle(async () => {
    await ensureStats();
    const me = await currentUser();
    const b = await body<{ gameId: string; question: string; context: string; options: string[]; statCodes?: string[]; period?: "season" | "last5"; source?: "editor" | "signal" }>(req);
    return ok({ discussion: createDiscussion(me?.id ?? "", { ...b, options: Array.isArray(b.options) ? b.options : [] }) }, { status: 201 });
  });
}

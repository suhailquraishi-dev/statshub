import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { FanPulseError, moderateComment } from "@/lib/store/store";

const ACTIONS = ["hide_comment", "remove_comment", "restore_comment", "suspend_user"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    const b = await body<{ action: (typeof ACTIONS)[number] }>(req);
    if (!ACTIONS.includes(b.action)) throw new FanPulseError("invalid", "Unknown action.");
    return ok({ comment: moderateComment(me?.id ?? "", id, b.action) });
  });
}

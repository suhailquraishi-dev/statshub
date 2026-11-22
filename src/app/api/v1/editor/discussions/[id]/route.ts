import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { FanPulseError, moderateDiscussion, setVerdict } from "@/lib/store/store";

const ACTIONS = ["approve_discussion", "feature", "unfeature", "lock", "unlock", "archive"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    const b = await body<{ action: (typeof ACTIONS)[number] | "verdict"; text?: string }>(req);
    if (b.action === "verdict") return ok({ discussion: setVerdict(me?.id ?? "", id, b.text ?? "") });
    if (!ACTIONS.includes(b.action)) throw new FanPulseError("invalid", "Unknown action.");
    return ok({ discussion: moderateDiscussion(me?.id ?? "", id, b.action) });
  });
}

import { ensureStats } from "@/lib/data/provider";
import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { createEvidenceSnapshot, type EvidenceRequest } from "@/lib/stats/evidence";
import { addComment, idempotent, listComments } from "@/lib/store/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    const b = await body<{ body: string; parentId?: string; evidence?: EvidenceRequest }>(req);
    const p = await ensureStats(b.evidence ? { gameId: b.evidence.contextGameId, teams: b.evidence.kind === "team" ? b.evidence.entityIds ?? [] : [] } : {});
    const key = req.headers.get("idempotency-key");
    const comment = idempotent(key && me ? `comment:${me.id}:${key}` : null, () => {
      // Evidence values are always rebuilt from the provider, never taken from the client.
      const evidence = b.evidence ? createEvidenceSnapshot(p, b.evidence) : undefined;
      return addComment(me?.id ?? null, { discussionId: id, body: String(b.body ?? ""), parentId: b.parentId ?? null, evidence });
    });
    const view = listComments(id, me?.id).find((c) => c.id === comment.id);
    return ok({ comment: view }, { status: 201 });
  });
}

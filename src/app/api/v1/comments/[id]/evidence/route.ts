import { ensureStats } from "@/lib/data/provider";
import { body, handle, ok } from "@/lib/server/api";
import { currentUser } from "@/lib/server/session";
import { createEvidenceSnapshot, type EvidenceRequest } from "@/lib/stats/evidence";
import { attachEvidence } from "@/lib/store/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const me = await currentUser();
    const b = await body<EvidenceRequest>(req);
    const p = await ensureStats({ gameId: b.contextGameId, teams: b.kind === "team" ? b.entityIds ?? [] : [] });
    const c = attachEvidence(me?.id ?? null, id, createEvidenceSnapshot(p, b));
    return ok({ evidence: c.evidence }, { status: 201 });
  });
}

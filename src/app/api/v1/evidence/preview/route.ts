import { ensureStats } from "@/lib/data/provider";
import { body, handle, ok } from "@/lib/server/api";
import { createEvidenceSnapshot, type EvidenceRequest } from "@/lib/stats/evidence";

/** Preview only: nothing is stored until the comment is posted. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<EvidenceRequest>(req);
    const p = await ensureStats({ gameId: b.contextGameId, teams: b.kind === "team" ? b.entityIds ?? [] : [] });
    return ok({ preview: createEvidenceSnapshot(p, b) });
  });
}

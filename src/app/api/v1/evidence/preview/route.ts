import { getProvider } from "@/lib/data/provider";
import { body, handle, ok } from "@/lib/server/api";
import { createEvidenceSnapshot, type EvidenceRequest } from "@/lib/stats/evidence";

/** Preview only: nothing is stored until the comment is posted. */
export async function POST(req: Request) {
  return handle(async () => ok({ preview: createEvidenceSnapshot(getProvider(), await body<EvidenceRequest>(req)) }));
}

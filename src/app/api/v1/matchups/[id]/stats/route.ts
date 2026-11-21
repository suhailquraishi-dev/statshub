import { getProvider } from "@/lib/data/provider";
import { handle, ok } from "@/lib/server/api";
import { matchupView } from "@/lib/server/view";
import { FanPulseError } from "@/lib/store/store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const period = new URL(req.url).searchParams.get("period") === "last5" ? "last5" : "season";
    const v = matchupView(id);
    if (!v) throw new FanPulseError("not_found", "Matchup not found.");
    return ok({ freshness: getProvider().freshness(), quick: v.quick[period], categories: { offense: v.categories.offense[period], defense: v.categories.defense[period], form: v.categories.form[period] } });
  });
}

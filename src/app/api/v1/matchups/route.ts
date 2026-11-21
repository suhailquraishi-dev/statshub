import { getProvider } from "@/lib/data/provider";
import { handle, ok } from "@/lib/server/api";

export async function GET() {
  return handle(() => {
    const p = getProvider();
    return ok({
      freshness: p.freshness(), isDemo: p.isDemo,
      matchups: p.games().map((g) => ({ ...g, home: p.team(g.homeTeamId), away: p.team(g.awayTeamId) })),
    });
  });
}

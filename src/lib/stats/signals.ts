import type { StatsProvider } from "@/lib/data/provider";
import { formatValue, teamMetric } from "@/lib/data/metrics";

/**
 * Deterministic signal engine (PRD §8). Finds notable changes between a
 * team's full season and its last 5 games, with the size of the change and
 * the sample, then drafts a neutral question for an editor to approve.
 * An LLM can later rephrase drafts; it never supplies the numbers.
 */
export interface Signal {
  id: string;
  gameId: string;
  teamId: string;
  metricCode: string;
  seasonValue: number;
  recentValue: number;
  change: number;
  relChange: number;
  sample: { season: number; recent: number };
  /** Plain-English summary with the actual numbers. */
  summary: string;
  draftQuestion: string;
  draftOptions: string[];
}

const WATCH = ["pts_pg", "pts_allowed_pg", "rush_yds_pg", "pass_yds_pg", "third_down_pct"];
const MIN_REL_CHANGE = 0.08;

export function findSignals(provider: StatsProvider): Signal[] {
  const out: Signal[] = [];
  for (const game of provider.games()) {
    if (game.status !== "scheduled") continue;
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      const team = provider.team(teamId)!;
      const season = provider.teamStats(teamId, game.season, "season");
      const recent = provider.teamStats(teamId, game.season, "last5");
      for (const code of WATCH) {
        const m = teamMetric(code);
        const s = season.values[code];
        const r = recent.values[code];
        if (s == null || r == null || s === 0) continue;
        const change = r - s;
        const rel = Math.abs(change) / Math.abs(s);
        if (rel < MIN_REL_CHANGE) continue;
        const improved = (change > 0) === m.higherIsBetter;
        const dir = change > 0 ? "up" : "down";
        out.push({
          id: `sig_${game.id}_${teamId}_${code}`,
          gameId: game.id, teamId, metricCode: code, seasonValue: s, recentValue: r, change, relChange: rel,
          sample: { season: season.gamesPlayed, recent: recent.gamesPlayed },
          summary: `${team.city} ${team.name}: ${m.label.toLowerCase()} is ${dir} from ${formatValue(m, s)} (season, ${season.gamesPlayed} games) to ${formatValue(m, r)} (last ${recent.gamesPlayed}).`,
          draftQuestion: improved
            ? `Is the ${team.name}' recent ${m.short.toLowerCase()} improvement for real?`.replace("Bison'", "Bison's")
            : `Should ${team.name} fans worry about the recent trend in ${m.short.toLowerCase()}?`,
          draftOptions: improved ? ["Yes, it will last", "No, it will cool off", "Too early to tell"] : ["Yes, it's a real problem", "No, it's a blip", "Too early to tell"],
        });
      }
    }
  }
  return out.sort((a, b) => b.relChange - a.relChange);
}

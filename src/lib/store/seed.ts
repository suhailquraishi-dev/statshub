import { getProvider } from "@/lib/data/provider";
import { formatValue, PERIOD_LABEL, teamMetric } from "@/lib/data/metrics";
import type { Period } from "@/lib/data/types";
import type { Discussion } from "./types";

/**
 * Editorial starter questions. Context sentences are computed from provider
 * numbers at seed time, never typed in, so they cannot drift from the stats.
 * No comments or votes are seeded: participation is never fabricated.
 */
function framing(gameId: string, code: string, period: Period): string {
  const p = getProvider();
  const game = p.game(gameId)!;
  const home = p.team(game.homeTeamId)!;
  const away = p.team(game.awayTeamId)!;
  const m = teamMetric(code);
  const hl = p.teamStats(home.id, game.season, period);
  const al = p.teamStats(away.id, game.season, period);
  return `${PERIOD_LABEL[period]} (${hl.gamesPlayed} and ${al.gamesPlayed} games): the ${home.name} average ${formatValue(m, hl.values[code] ?? null)} ${m.label.toLowerCase()}, the ${away.name} ${formatValue(m, al.values[code] ?? null)}.`;
}

export function seedDiscussions(staffId: string): Discussion[] {
  const t0 = Date.now();
  const mk = (
    n: number, gameId: string, question: string, code: string, period: Period, options: string[],
    extra: Partial<Discussion> = {},
  ): Discussion => {
    const id = `d${n}`;
    const at = new Date(t0 - n * 60_000).toISOString();
    return {
      id, slug: question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60),
      gameId, question, context: framing(gameId, code, period), statCodes: [code], period,
      status: "published", featured: false, source: "editor", createdBy: staffId, createdAt: at, updatedAt: at,
      poll: { id: `poll_${id}`, discussionId: id, options: options.map((label, i) => ({ id: `o${i + 1}`, label })) },
      ...extra,
    };
  };
  return [
    mk(101, "2026-w12-hcm-rvh", "Which offense would you trust in a close game?", "pts_pg", "last5", ["Mariners", "Hawks", "Too close to call"], { featured: true }),
    mk(102, "2026-w12-hcm-rvh", "Does the Hawks' run game decide this one?", "rush_yds_pg", "season", ["Yes, it's the key", "No, it's the passing game", "Defense decides it"]),
    mk(103, "2026-w12-mfb-lsp", "Can the Pioneers' defense slow down the Bison?", "pts_allowed_pg", "season", ["Yes", "No", "Only if they win the turnover battle"], { featured: true }),
    mk(104, "2026-w12-gcr-nps", "Which team's recent form is more believable?", "point_diff_pg", "last5", ["Rays", "Stags", "Neither"], { featured: true }),
    mk(105, "2026-w11-rvh-mfb", "What decided the Bison's win in Red Valley?", "takeaways_pg", "season", ["Their defense", "Their offense", "Hawks' mistakes"], { featured: true }),
  ];
}

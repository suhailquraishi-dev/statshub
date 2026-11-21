import { getProvider } from "@/lib/data/provider";
import { QUICK_STAT_CODES, TEAM_METRICS } from "@/lib/data/metrics";
import type { Game, Period, Team } from "@/lib/data/types";
import { compareTeams, type Comparison } from "@/lib/stats/compare";
import { commentCount, listDiscussions, participationStats, pollResults } from "@/lib/store/store";
import type { Discussion, PollResults } from "@/lib/store/types";
import { rankScore } from "@/lib/stats/ranking";

export interface MatchupView {
  game: Game;
  home: Team;
  away: Team;
  quick: Record<Period, Comparison>;
  categories: Record<"offense" | "defense" | "form", Record<Period, Comparison>>;
}

export function matchupView(gameId: string): MatchupView | null {
  const p = getProvider();
  const game = p.game(gameId);
  if (!game) return null;
  const home = p.team(game.homeTeamId)!;
  const away = p.team(game.awayTeamId)!;
  const build = (codes: string[], period: Period) =>
    compareTeams(home, away, p.teamStats(home.id, game.season, period), p.teamStats(away.id, game.season, period), codes);
  const cat = (c: "offense" | "defense" | "form") => {
    const codes = TEAM_METRICS.filter((m) => m.category === c).map((m) => m.code);
    return { season: build(codes, "season"), last5: build(codes, "last5") };
  };
  return {
    game, home, away,
    quick: { season: build(QUICK_STAT_CODES, "season"), last5: build(QUICK_STAT_CODES, "last5") },
    categories: { offense: cat("offense"), defense: cat("defense"), form: cat("form") },
  };
}

export interface DiscussionCard {
  discussion: Discussion;
  comments: number;
  poll: PollResults;
  home: Team;
  away: Team;
  game: Game;
}

export function discussionCards(opts: { gameId?: string; viewerId?: string | null } = {}): DiscussionCard[] {
  const p = getProvider();
  return listDiscussions({ gameId: opts.gameId }).map((d) => {
    const game = p.game(d.gameId)!;
    return { discussion: d, comments: commentCount(d.id), poll: pollResults(d.id, opts.viewerId), game, home: p.team(game.homeTeamId)!, away: p.team(game.awayTeamId)! };
  });
}

export function rankedDiscussions(viewerId?: string | null): DiscussionCard[] {
  return discussionCards({ viewerId })
    .map((c) => {
      const s = participationStats(c.discussion.id);
      return { c, score: rankScore({ ...s, relevance: 0.5, significance: 0.5, createdAt: c.discussion.createdAt, featured: c.discussion.featured }) };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

export function discussionPath(d: Pick<Discussion, "id" | "slug">) {
  return `/fanpulse/nfl/discussions/${d.id}-${d.slug}`;
}
export function matchupPath(gameId: string) {
  return `/fanpulse/nfl/matchups/${gameId}`;
}

/** Parse "{id}-{slug}"; the id alone is canonical, so a changed slug still resolves. */
export function parseDiscussionParam(param: string): string {
  return param.split("-")[0];
}

export function evidenceOptions(gameId: string) {
  const p = getProvider();
  const game = p.game(gameId)!;
  return {
    gameId,
    teams: p.teams().map((t) => ({ id: t.id, label: `${t.city} ${t.name}` })),
    players: p.teams().flatMap((t) => p.players(t.id).map((pl) => ({ id: pl.id, label: pl.name, position: pl.position, teamId: t.id }))),
    defaultTeams: [game.homeTeamId, game.awayTeamId] as [string, string],
  };
}

export function playerBundles(teamId: string, season: number) {
  const p = getProvider();
  return p.players(teamId).map((player) => ({
    player,
    stats: { season: p.playerStats(player.id, season, "season"), last5: p.playerStats(player.id, season, "last5") },
  }));
}

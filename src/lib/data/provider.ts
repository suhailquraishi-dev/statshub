import type {
  Article, Leaderboard, TeamResult, DataFreshness, Game, PastMeeting, Period, Player, PlayerStatLine, Team, TeamStatLine,
} from "./types";
import { demoProvider } from "./demo-provider";
import { ensureEsData, ensureEsTeams, esProvider } from "./es/provider";

/**
 * Provider adapter (PRD §9). UI code talks to this interface only.
 * STATS_PROVIDER=es uses the ES Stats API (src/lib/data/es); anything else uses
 * the demo provider (fictional teams, "Demo data" banner).
 */
export interface StatsProvider {
  readonly name: string;
  /** True when values are sample data, not real statistics. */
  readonly isDemo: boolean;
  freshness(): DataFreshness;
  teams(): Team[];
  team(id: string): Team | undefined;
  games(): Game[];
  game(id: string): Game | undefined;
  teamStats(teamId: string, season: number, period: Period): TeamStatLine;
  players(teamId: string): Player[];
  player(id: string): Player | undefined;
  playerStats(playerId: string, season: number, period: Period): PlayerStatLine;
  headToHead(teamA: string, teamB: string): PastMeeting[];
  relatedArticles(teamIds: string[]): Article[];
  /** League leaders (top 5) for a few headline stats; empty when unavailable. */
  leaders(): Leaderboard[];
  /** A team's latest finished games, newest first. */
  recentResults(teamId: string, n: number): TeamResult[];
  /** A team's next unplayed game this season. */
  nextGame(teamId: string): Game | undefined;
}

export function usingRealStats(): boolean {
  return process.env.STATS_PROVIDER === "es";
}

export function getProvider(): StatsProvider {
  return usingRealStats() ? esProvider : demoProvider;
}

/**
 * Call before reading stats on the server (pages, API routes). Real providers
 * load their snapshot here; `teams` also loads matchup extras (players, last
 * five games) for those team ids. The demo provider needs nothing.
 */
export async function ensureStats(opts: { teams?: string[]; gameId?: string } = {}): Promise<StatsProvider> {
  if (!usingRealStats()) return demoProvider;
  await ensureEsData();
  const teams = [...(opts.teams ?? [])];
  if (opts.gameId) {
    const g = esProvider.game(opts.gameId);
    if (g) teams.push(g.homeTeamId, g.awayTeamId);
  }
  if (teams.length) await ensureEsTeams(teams);
  return esProvider;
}

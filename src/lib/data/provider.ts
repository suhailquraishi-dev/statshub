import type {
  Article, DataFreshness, Game, PastMeeting, Period, Player, PlayerStatLine, Team, TeamStatLine,
} from "./types";
import { demoProvider } from "./demo-provider";

/**
 * Provider adapter (PRD §9). The real stats vendor is not chosen yet, so the
 * app talks to this interface and a demo implementation stands in. Swapping
 * vendors means writing one new adapter, not touching UI code.
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
}

export function getProvider(): StatsProvider {
  // Only one adapter exists today. A licensed vendor adapter plugs in here,
  // selected by env (e.g. STATS_PROVIDER=sportradar).
  return demoProvider;
}

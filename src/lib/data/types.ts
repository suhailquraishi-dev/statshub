/**
 * Normalized internal schema. UI components read these shapes only, never a
 * vendor payload (PRD §9). Internal IDs are kept separate from provider IDs.
 */

export type Period = "season" | "last5";
export type SeasonType = "regular" | "postseason";
export type Unit = "points" | "yards" | "percent" | "count" | "rating";
export type Aggregation = "per_game" | "total" | "rate";
export type MetricCategory = "offense" | "defense" | "form";

export interface MetricDef {
  code: string;
  label: string;
  short: string;
  unit: Unit;
  aggregation: Aggregation;
  /** Whether a higher value is the favorable one (PRD §9 data integrity). */
  higherIsBetter: boolean;
  category: MetricCategory;
  decimals: number;
  /** One plain-English sentence on why the number matters. */
  meaning: string;
}

export interface Team {
  id: string;
  providerId: string;
  city: string;
  name: string;
  abbr: string;
  /** Two team colours for the crest dot. Content data, not UI chrome. */
  colors: [string, string];
  record: { w: number; l: number; t: number };
}

export type GameStatus = "scheduled" | "final" | "postponed";

export interface Game {
  id: string;
  providerId: string;
  competition: "NFL";
  season: number;
  seasonType: SeasonType;
  week: number;
  kickoff: string; // ISO
  venue: string;
  homeTeamId: string;
  awayTeamId: string;
  status: GameStatus;
  score?: { home: number; away: number };
}

export interface TeamStatLine {
  teamId: string;
  season: number;
  seasonType: SeasonType;
  period: Period;
  gamesPlayed: number;
  values: Record<string, number | null>;
}

export interface Player {
  id: string;
  providerId: string;
  teamId: string;
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "EDGE" | "LB" | "CB";
}

export interface PlayerStatLine {
  playerId: string;
  season: number;
  seasonType: SeasonType;
  period: Period;
  gamesPlayed: number;
  values: Record<string, number | null>;
}

export interface PastMeeting {
  gameId: string;
  season: number;
  seasonType: SeasonType;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  score: { home: number; away: number };
}

export interface DataFreshness {
  source: string;
  ingestedAt: string; // ISO
  /** Data older than this is shown with a stale warning. */
  staleAfterMinutes: number;
}

export interface Article {
  id: string;
  title: string;
  teamIds: string[];
  url: string;
}

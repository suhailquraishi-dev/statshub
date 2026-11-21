/**
 * Pure mapping from the ES Stats API (es-stats, MySportsFeeds-backed) to the
 * FanPulse internal schema. No network here, so every rule is unit-tested.
 *
 * Every number shown comes from an API field or simple arithmetic on API
 * fields (totals ÷ games). Metrics the API does not provide stay null and are
 * hidden by the UI, never estimated.
 */
import type { Game, GameStatus, PastMeeting, Player, SeasonType, Team } from "../types";

/* ───── Raw API shapes (only the fields we read) ───── */

export type StatMap = Record<string, number | null | undefined>;

export interface RawSeason { slug: string; name: string; start_date: string; end_date: string; interval: string }
export interface RawTeam { team_id: number; abbr: string; city: string; name: string; colors?: string[]; logo?: string | null; venue?: string | null }
export interface RawGame {
  game_id: number; season: string; week: number; start_time: string; date: string;
  away: string; home: string; away_score: number | null; home_score: number | null; status: string; venue: string | null;
}
export interface RawTeamStats { team: string; games_played: number; stats: StatMap }
export interface RawPlayerStats { player_id: number; name: string; position: string; team: string; games_played: number; stats: StatMap }
export interface RawBoxscore {
  game: RawGame;
  teams: { team: string; opp: string; home: boolean; stats: StatMap }[];
  players: { player_id: number; name: string; position: string; team: string; stats: StatMap }[];
}

/* ───── Stat keys ───── */

export const K = {
  pointsFor: "standings.pointsFor",
  pointsAgainst: "standings.pointsAgainst",
  wins: "standings.wins",
  losses: "standings.losses",
  ties: "standings.ties",
  offenseYds: "miscellaneous.offenseYds",
  passNetYds: "passing.passNetYards",
  rushYds: "rushing.rushYards",
  thirdDowns: "miscellaneous.thirdDowns",
  thirdDownsAtt: "miscellaneous.thirdDownsAtt",
  thirdDownsPct: "miscellaneous.thirdDownsPct",
  sacks: "tackles.sacks",
  ints: "interceptions.interceptions",
  fumOppRec: "fumbles.fumOppRec",
  passInt: "passing.passInt",
  fumLost: "fumbles.fumLost",
  passYds: "passing.passYards",
  passTD: "passing.passTD",
  passAtt: "passing.passAttempts",
  passComp: "passing.passCompletions",
  qbRating: "passing.qbRating",
  rushTD: "rushing.rushTD",
  recYds: "receiving.recYards",
  recTD: "receiving.recTD",
} as const;

export const TEAM_FIELDS = [K.pointsFor, K.pointsAgainst, K.wins, K.losses, K.ties, K.offenseYds, K.passNetYds, K.rushYds,
  K.thirdDowns, K.thirdDownsAtt, K.thirdDownsPct, K.sacks, K.ints, K.fumOppRec, K.passInt, K.fumLost];
export const PLAYER_FIELDS = [K.passYds, K.passTD, K.passAtt, K.passComp, K.passInt, K.qbRating, K.rushYds, K.rushTD, K.recYds, K.recTD];

/* ───── Helpers ───── */

const num = (s: StatMap, k: string): number | null => {
  const v = s[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const round = (v: number | null, d = 1): number | null => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const per = (v: number | null, gp: number) => (v === null || gp <= 0 ? null : round(v / gp));
const add = (...xs: (number | null)[]) => (xs.some((x) => x === null) ? null : xs.reduce<number>((a, b) => a + (b as number), 0));

/** Sum stat maps key by key (for multi-game totals from box scores). */
export function sumStats(maps: StatMap[], keys: readonly string[]): StatMap {
  const out: StatMap = {};
  for (const k of keys) {
    let total = 0;
    let seen = false;
    for (const m of maps) {
      const v = num(m, k);
      if (v !== null) { total += v; seen = true; }
    }
    out[k] = seen ? total : null;
  }
  return out;
}

/** "2026-2027-regular" -> { year: 2026, type: "regular" } */
export function parseSeason(slug: string): { year: number; type: SeasonType } {
  const year = Number.parseInt(slug.slice(0, 4), 10);
  return { year, type: /playoff|post/i.test(slug) ? "postseason" : "regular" };
}

export const teamId = (abbr: string) => abbr.toLowerCase();

export function gameId(g: Pick<RawGame, "season" | "week" | "home" | "away">): string {
  return `${parseSeason(g.season).year}-w${g.week}-${g.home}-${g.away}`.toLowerCase();
}

/* ───── Teams and games ───── */

export function mapTeam(t: RawTeam, record: { w: number; l: number; t: number }): Team {
  const colors = (t.colors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  return {
    id: teamId(t.abbr),
    providerId: String(t.team_id),
    city: t.city,
    name: t.name,
    abbr: t.abbr,
    colors: [colors[0] ?? "#1f2126", colors[1] ?? "#ffffff"],
    logoUrl: t.logo ?? undefined,
    record,
  };
}

export function recordFrom(stats: StatMap | undefined) {
  if (!stats) return { w: 0, l: 0, t: 0 };
  return { w: num(stats, K.wins) ?? 0, l: num(stats, K.losses) ?? 0, t: num(stats, K.ties) ?? 0 };
}

const STATUS: Record<string, GameStatus> = { UNPLAYED: "scheduled", COMPLETED: "final", POSTPONED: "postponed" };

export function mapGame(g: RawGame): Game {
  const { year, type } = parseSeason(g.season);
  const status = STATUS[g.status] ?? "scheduled";
  return {
    id: gameId(g),
    providerId: String(g.game_id),
    competition: "NFL",
    season: year,
    seasonType: type,
    week: g.week,
    kickoff: new Date(g.start_time).toISOString(),
    venue: g.venue ?? "Venue to be confirmed",
    homeTeamId: teamId(g.home),
    awayTeamId: teamId(g.away),
    status,
    score: status === "final" && g.home_score !== null && g.away_score !== null ? { home: g.home_score, away: g.away_score } : undefined,
  };
}

/** The current week is the earliest week that still has an unplayed game; after the season, the last week. */
export function currentWeek(games: RawGame[]): number {
  const open = games.filter((g) => g.status === "UNPLAYED").map((g) => g.week);
  if (open.length) return Math.min(...open);
  return games.length ? Math.max(...games.map((g) => g.week)) : 1;
}

/** A team's completed games, newest first. */
export function completedFor(games: RawGame[], abbr: string): RawGame[] {
  return games
    .filter((g) => g.status === "COMPLETED" && (g.home === abbr || g.away === abbr) && g.home_score !== null && g.away_score !== null)
    .sort((a, b) => b.start_time.localeCompare(a.start_time));
}

export function headToHead(games: RawGame[], a: string, b: string): PastMeeting[] {
  return games
    .filter((g) => g.status === "COMPLETED" && g.home_score !== null && g.away_score !== null
      && ((g.home === a && g.away === b) || (g.home === b && g.away === a)))
    .sort((x, y) => y.start_time.localeCompare(x.start_time))
    .map((g) => {
      const { year, type } = parseSeason(g.season);
      return {
        gameId: gameId(g), season: year, seasonType: type, date: g.date,
        homeTeamId: teamId(g.home), awayTeamId: teamId(g.away), score: { home: g.home_score!, away: g.away_score! },
      };
    });
}

/* ───── Team metrics ───── */

type Values = Record<string, number | null>;

/** Points-based metrics straight from final scores (used for the last 5 games, always available). */
export function teamValuesFromScores(recent: RawGame[], abbr: string): { gamesPlayed: number; values: Values } {
  let pf = 0;
  let pa = 0;
  for (const g of recent) {
    const home = g.home === abbr;
    pf += (home ? g.home_score : g.away_score) ?? 0;
    pa += (home ? g.away_score : g.home_score) ?? 0;
  }
  const gp = recent.length;
  return { gamesPlayed: gp, values: { pts_pg: per(pf, gp), pts_allowed_pg: per(pa, gp), point_diff_pg: per(pf - pa, gp) } };
}

/** Season metrics from the season totals in /team-stats. */
export function teamSeasonValues(row: RawTeamStats): { gamesPlayed: number; values: Values } {
  const s = row.stats;
  const gp = row.games_played;
  const take = add(num(s, K.ints), num(s, K.fumOppRec));
  const give = add(num(s, K.passInt), num(s, K.fumLost));
  const pf = num(s, K.pointsFor);
  const pa = num(s, K.pointsAgainst);
  return {
    gamesPlayed: gp,
    values: {
      pts_pg: per(pf, gp),
      yds_pg: per(num(s, K.offenseYds), gp),
      pass_yds_pg: per(num(s, K.passNetYds), gp),
      rush_yds_pg: per(num(s, K.rushYds), gp),
      third_down_pct: round(num(s, K.thirdDownsPct)),
      red_zone_pct: null, // not provided by the API
      pts_allowed_pg: per(pa, gp),
      yds_allowed_pg: null, // season yards allowed is not provided by the API
      sacks_pg: per(num(s, K.sacks), gp),
      takeaways_pg: per(take, gp),
      turnover_diff: take === null || give === null ? null : take - give,
      point_diff_pg: pf === null || pa === null ? null : per(pf - pa, gp),
    },
  };
}

/** Last-N metrics from box scores: this team's lines and its opponents' lines in the same games. */
export function teamBoxValues(boxes: RawBoxscore[], abbr: string): { gamesPlayed: number; values: Values } {
  const mine: StatMap[] = [];
  const theirs: StatMap[] = [];
  for (const b of boxes) {
    const me = b.teams.find((t) => t.team === abbr);
    const opp = b.teams.find((t) => t.team !== abbr);
    if (me && opp) { mine.push(me.stats); theirs.push(opp.stats); }
  }
  const gp = mine.length;
  const s = sumStats(mine, TEAM_FIELDS);
  const o = sumStats(theirs, [K.offenseYds, K.pointsFor]);
  const att = num(s, K.thirdDownsAtt);
  const take = add(num(s, K.ints), num(s, K.fumOppRec));
  const give = add(num(s, K.passInt), num(s, K.fumLost));
  return {
    gamesPlayed: gp,
    values: {
      yds_pg: per(num(s, K.offenseYds), gp),
      pass_yds_pg: per(num(s, K.passNetYds), gp),
      rush_yds_pg: per(num(s, K.rushYds), gp),
      third_down_pct: att ? round(((num(s, K.thirdDowns) ?? 0) / att) * 100) : null,
      red_zone_pct: null,
      yds_allowed_pg: per(num(o, K.offenseYds), gp),
      sacks_pg: per(num(s, K.sacks), gp),
      takeaways_pg: per(take, gp),
      turnover_diff: take === null || give === null ? null : take - give,
    },
  };
}

/* ───── Players ───── */

export const SPOTLIGHT: Record<"QB" | "RB" | "WR", string> = { QB: K.passYds, RB: K.rushYds, WR: K.recYds };

/** The team's leading QB, RB and WR by yards (season), for the player spotlight. */
export function pickSpotlight(rows: RawPlayerStats[]): RawPlayerStats[] {
  const out: RawPlayerStats[] = [];
  for (const [pos, key] of Object.entries(SPOTLIGHT)) {
    const best = rows
      .filter((r) => r.position === pos && (num(r.stats, key) ?? 0) > 0)
      .sort((a, b) => (num(b.stats, key) ?? 0) - (num(a.stats, key) ?? 0))[0];
    if (best) out.push(best);
  }
  return out;
}

export function mapPlayer(r: Pick<RawPlayerStats, "player_id" | "name" | "position" | "team">): Player {
  return { id: `p-${r.player_id}`, providerId: String(r.player_id), teamId: teamId(r.team), name: r.name, position: r.position as Player["position"] };
}

/** NFL passer rating from totals (each component clamped to 0..2.375). */
export function passerRating(comp: number, att: number, yds: number, td: number, int: number): number | null {
  if (!att) return null;
  const c = (x: number) => Math.min(2.375, Math.max(0, x));
  const a = c((comp / att - 0.3) * 5);
  const b = c((yds / att - 3) * 0.25);
  const t = c((td / att) * 20);
  const i = c(2.375 - (int / att) * 25);
  return round(((a + b + t + i) / 6) * 100);
}

/** Player metrics from a stat total. `rating` is the API's season rating when given, else computed. */
export function playerValues(position: string, s: StatMap, gp: number, rating?: number | null): Values {
  const v: Values = { pass_yds_pg: null, pass_td: null, passer_rating: null, rush_yds_pg: null, rec_yds_pg: null, total_td: null };
  if (position === "QB") {
    v.pass_yds_pg = per(num(s, K.passYds), gp);
    v.pass_td = num(s, K.passTD);
    v.passer_rating = rating !== undefined ? round(rating ?? null)
      : passerRating(num(s, K.passComp) ?? 0, num(s, K.passAtt) ?? 0, num(s, K.passYds) ?? 0, num(s, K.passTD) ?? 0, num(s, K.passInt) ?? 0);
    v.rush_yds_pg = per(num(s, K.rushYds), gp);
  } else if (position === "RB") {
    v.rush_yds_pg = per(num(s, K.rushYds), gp);
    v.rec_yds_pg = per(num(s, K.recYds), gp);
    v.total_td = add(num(s, K.rushTD), num(s, K.recTD));
  } else {
    v.rec_yds_pg = per(num(s, K.recYds), gp);
    v.total_td = add(num(s, K.rushTD), num(s, K.recTD));
  }
  return v;
}

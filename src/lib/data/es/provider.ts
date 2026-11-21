import type { StatsProvider } from "../provider";
import type { DataFreshness, Game, Leaderboard, Period, Player, PlayerStatLine, Team, TeamStatLine } from "../types";
import {
  completedFor, currentWeek, headToHead, LEADER_METRICS, mapGame, mapLeaders, mapStandings, nextGameFor, recentResults, mapPlayer, mapTeam, parseSeason, pickSpotlight, PLAYER_FIELDS,
  playerValues, recordFrom, sumStats, TEAM_FIELDS, teamBoxValues, teamId, teamSeasonValues, teamValuesFromScores,
  type RawBoxscore, type RawGame, type RawLeaders, type RawStanding, type RawPlayerStats, type RawSeason, type RawTeam, type RawTeamStats,
} from "./map";

/**
 * ES Stats API adapter (es-stats.duckdns.org, MySportsFeeds-backed).
 *
 * The app reads stats synchronously, so data is loaded into an in-memory
 * snapshot first: `ensureEsData()` loads the league-wide base (season, teams,
 * team stats, this and last season's games), and `ensureEsTeams()` adds the
 * per-team extras a matchup needs (spotlight players and the last five box
 * scores). Responses go through Next's fetch cache, so server instances share
 * them. The token is read from STATS_API_KEY and never logged.
 */

const LEAGUE = "nfl";
const BASE_TTL_MS = 10 * 60_000; // re-check the base snapshot every 10 min
const REVALIDATE_S = 15 * 60; // shared fetch cache for live-ish data
const FINAL_REVALIDATE_S = 24 * 3600; // box scores of finished games do not change

export class StatsUnavailableError extends Error {}

async function call<T>(path: string, revalidate = REVALIDATE_S): Promise<{ data: T; fetchedAt: string | null }> {
  const base = (process.env.STATS_API_BASE_URL ?? "https://es-stats.duckdns.org").replace(/\/$/, "");
  const key = process.env.STATS_API_KEY;
  if (!key) throw new StatsUnavailableError("STATS_API_KEY is not set.");
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new StatsUnavailableError(`Stats API ${res.status} for ${path.split("?")[0]}`);
  const body = (await res.json()) as { data: T; meta?: { fetched_at?: string | null } };
  return { data: body.data, fetchedAt: body.meta?.fetched_at ?? null };
}

interface Base {
  loadedAt: number;
  fetchedAt: string;
  seasonSlug: string;
  season: number;
  teams: Team[];
  rawGames: RawGame[]; // current season
  prevGames: RawGame[]; // previous season, for head-to-head
  games: Game[]; // all current-season games, mapped
  window: Game[]; // the current week plus the week before (what the site lists)
  teamStats: Map<string, RawTeamStats>; // by abbr
  leaders: Leaderboard[];
}

interface TeamExtras {
  players: Player[];
  season: Map<string, RawPlayerStats>; // by internal player id
  boxes: RawBoxscore[]; // box scores the API has for the last 5 completed games, newest first
  recentCount: number; // how many of the last 5 completed games exist (boxes may be fewer)
}

const state = globalThis as unknown as {
  __esBase?: Base;
  __esBaseLoading?: Promise<Base>;
  __esTeams?: Map<string, TeamExtras>;
  __esTeamsLoading?: Map<string, Promise<void>>;
};
const teamsCache = (): Map<string, TeamExtras> => (state.__esTeams ??= new Map<string, TeamExtras>());
const teamsLoading = (): Map<string, Promise<void>> => (state.__esTeamsLoading ??= new Map<string, Promise<void>>());

async function loadBase(): Promise<Base> {
  const { data: season } = await call<RawSeason>(`/v1/${LEAGUE}/seasons/current`);
  const { year } = parseSeason(season.slug);
  const prevSlug = season.slug.replace(/^(\d{4})-(\d{4})/, `${year - 1}-${year}`);
  const optional = <T,>(p: Promise<{ data: T }>, fallback: T) => p.then((r) => r.data).catch(() => fallback);
  const [teamsRes, statsRes, gamesRes, prevRes, standings, leaders] = await Promise.all([
    call<RawTeam[]>(`/v1/${LEAGUE}/teams`),
    call<RawTeamStats[]>(`/v1/${LEAGUE}/team-stats?fields=${TEAM_FIELDS.join(",")}`),
    call<RawGame[]>(`/v1/${LEAGUE}/games`),
    call<RawGame[]>(`/v1/${LEAGUE}/games?season=${prevSlug}`, FINAL_REVALIDATE_S).catch(() => ({ data: [] as RawGame[], fetchedAt: null })),
    // Standings and leaders are extras: if they fail, those sections hide; the rest still works.
    optional(call<RawStanding[]>(`/v1/${LEAGUE}/standings`), [] as RawStanding[]),
    Promise.all(LEADER_METRICS.map((m) =>
      optional(call<RawLeaders>(`/v1/${LEAGUE}/leaders?metric=${m.metric}&kind=player&limit=5`), null as RawLeaders | null)
        .then((r) => (r && r.leaders?.length ? mapLeaders(r, m.label) : null)))),
  ]);
  const teamStats = new Map(statsRes.data.map((r) => [r.team, r]));
  const ranks = mapStandings(standings);
  const teams = teamsRes.data.map((t) => ({ ...mapTeam(t, recordFrom(teamStats.get(t.abbr)?.stats)), ...ranks.get(t.abbr) }));
  const rawGames = gamesRes.data;
  const games = rawGames.map(mapGame);
  const wk = currentWeek(rawGames);
  const window = games.filter((g) => g.week === wk || g.week === wk - 1);
  return {
    loadedAt: Date.now(),
    fetchedAt: statsRes.fetchedAt ?? gamesRes.fetchedAt ?? new Date().toISOString(),
    seasonSlug: season.slug,
    season: year,
    teams,
    rawGames,
    prevGames: prevRes.data,
    games,
    window,
    teamStats,
    leaders: leaders.filter((x): x is Leaderboard => x !== null),
  };
}

/** Load (or refresh) the league-wide snapshot. Keeps serving the last good copy if a refresh fails. */
export async function ensureEsData(): Promise<void> {
  const cur = state.__esBase;
  if (cur && Date.now() - cur.loadedAt < BASE_TTL_MS) return;
  state.__esBaseLoading ??= loadBase().finally(() => { state.__esBaseLoading = undefined; });
  try {
    const next = await state.__esBaseLoading;
    if (cur && cur.seasonSlug !== next.seasonSlug) teamsCache().clear();
    state.__esBase = next;
  } catch (err) {
    if (!cur) throw err instanceof StatsUnavailableError ? err : new StatsUnavailableError(String(err));
    console.error("[stats] refresh failed, serving last snapshot:", err instanceof Error ? err.message : err);
  }
}

async function loadTeam(b: Base, abbr: string): Promise<TeamExtras> {
  const recent = completedFor(b.rawGames, abbr).slice(0, 5);
  const [playersRes, boxes] = await Promise.all([
    call<RawPlayerStats[]>(`/v1/${LEAGUE}/player-stats?team=${abbr}&fields=${PLAYER_FIELDS.join(",")}`),
    // The API keeps box scores only from 2026-11-08 on (MySportsFeeds serves game data for 7 days),
    // so older games return 403. Missing boxes are skipped, never estimated.
    Promise.all(recent.map((g) => call<RawBoxscore>(`/v1/${LEAGUE}/boxscores/${g.game_id}`, FINAL_REVALIDATE_S)
      .then((r) => r.data).catch(() => null))),
  ]);
  const picks = pickSpotlight(playersRes.data);
  return {
    players: picks.map(mapPlayer),
    season: new Map(picks.map((r) => [mapPlayer(r).id, r])),
    boxes: boxes.filter((x): x is RawBoxscore => x !== null),
    recentCount: recent.length,
  };
}

/** Load the matchup extras (spotlight players, last five box scores) for these team ids. */
export async function ensureEsTeams(ids: string[]): Promise<void> {
  await ensureEsData();
  const b = state.__esBase!;
  await Promise.all([...new Set(ids)].map(async (id) => {
    if (teamsCache().has(id)) return;
    const abbr = b.teams.find((t) => t.id === id)?.abbr;
    if (!abbr) return;
    let p = teamsLoading().get(id);
    if (!p) {
      p = loadTeam(b, abbr)
        .then((x) => { teamsCache().set(id, x); })
        .catch((err) => { console.error(`[stats] team extras failed for ${abbr}:`, err instanceof Error ? err.message : err); })
        .finally(() => teamsLoading().delete(id));
      teamsLoading().set(id, p);
    }
    await p;
  }));
}

function base(): Base {
  const b = state.__esBase;
  if (!b) throw new StatsUnavailableError("Stats are not loaded yet.");
  return b;
}

function abbrOf(id: string) {
  const t = base().teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t.abbr;
}

export const esProvider: StatsProvider = {
  name: "ES Stats",
  isDemo: false,
  freshness(): DataFreshness {
    return { source: "ES Stats (MySportsFeeds)", ingestedAt: base().fetchedAt, staleAfterMinutes: 6 * 60 };
  },
  teams: () => base().teams,
  team: (id) => base().teams.find((t) => t.id === id),
  games: () => base().window,
  game: (id) => base().games.find((g) => g.id === id),
  teamStats(id, season, period: Period): TeamStatLine {
    const b = base();
    if (season !== b.season) throw new Error(`No stats for ${id} in ${season}`);
    const abbr = abbrOf(id);
    const line = { teamId: id, season, seasonType: "regular" as const, period };
    if (period === "season") {
      const row = b.teamStats.get(abbr);
      if (!row) throw new Error(`No stats for ${id}`);
      return { ...line, ...teamSeasonValues(row) };
    }
    const scores = teamValuesFromScores(completedFor(b.rawGames, abbr).slice(0, 5), abbr);
    const boxes = teamsCache().get(id)?.boxes ?? [];
    const fromBox = boxes.length === scores.gamesPlayed ? teamBoxValues(boxes, abbr).values : {};
    const all = ["pts_pg", "yds_pg", "pass_yds_pg", "rush_yds_pg", "third_down_pct", "red_zone_pct", "pts_allowed_pg", "yds_allowed_pg", "sacks_pg", "takeaways_pg", "turnover_diff", "point_diff_pg"];
    const values: Record<string, number | null> = {};
    for (const k of all) values[k] = scores.values[k] ?? fromBox[k] ?? null;
    return { ...line, gamesPlayed: scores.gamesPlayed, values };
  },
  players: (id) => teamsCache().get(id)?.players ?? [],
  player(id) {
    for (const x of teamsCache().values()) {
      const p = x.players.find((pl) => pl.id === id);
      if (p) return p;
    }
    return undefined;
  },
  playerStats(id, season, period): PlayerStatLine {
    const b = base();
    if (season !== b.season) throw new Error(`No stats for ${id} in ${season}`);
    const ex = [...teamsCache().values()].find((x) => x.season.has(id));
    const raw = ex?.season.get(id);
    if (!ex || !raw) throw new Error(`No stats for ${id}`);
    const line = { playerId: id, season, seasonType: "regular" as const, period };
    if (period === "season") {
      return { ...line, gamesPlayed: raw.games_played, values: playerValues(raw.position, raw.stats, raw.games_played, raw.stats["passing.qbRating"] ?? null) };
    }
    // Last-5 player numbers only when every one of the team's last five box scores is available.
    if (ex.boxes.length < ex.recentCount || ex.recentCount === 0) {
      return { ...line, gamesPlayed: 0, values: { pass_yds_pg: null, pass_td: null, passer_rating: null, rush_yds_pg: null, rec_yds_pg: null, total_td: null } };
    }
    const lines = ex.boxes.flatMap((bx) => bx.players.filter((p) => p.player_id === raw.player_id).map((p) => p.stats));
    const totals = sumStats(lines, PLAYER_FIELDS);
    return { ...line, gamesPlayed: lines.length, values: playerValues(raw.position, totals, lines.length) };
  },
  headToHead(a, b2) {
    const b = base();
    return headToHead([...b.rawGames, ...b.prevGames], abbrOf(a), abbrOf(b2));
  },
  relatedArticles: () => [],
  leaders: () => base().leaders,
  recentResults: (id, n) => recentResults(base().rawGames, abbrOf(id), n),
  nextGame(id) {
    const g = nextGameFor(base().rawGames, abbrOf(id));
    return g ? base().games.find((x) => x.providerId === String(g.game_id)) : undefined;
  },
};

export { teamId };

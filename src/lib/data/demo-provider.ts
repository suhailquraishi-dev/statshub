import type {
  Article, DataFreshness, Game, PastMeeting, Period, Player, PlayerStatLine, Team, TeamStatLine,
} from "./types";
import type { StatsProvider } from "./provider";

/**
 * DEMO DATA. Fictional teams and players with generated numbers, so the
 * prototype never presents invented figures as real NFL statistics. The UI
 * shows a "Demo data" banner whenever provider.isDemo is true.
 */

const SEASON = 2026;
const LOADED_AT = Date.now() - 95 * 60 * 1000; // pretend the last refresh was 95 min ago

const TEAMS: Team[] = [
  { id: "hcm", providerId: "demo-t-01", city: "Harbor City", name: "Mariners", abbr: "HCM", colors: ["#0B3D5C", "#E8B23A"], record: { w: 8, l: 3, t: 0 } },
  { id: "rvh", providerId: "demo-t-02", city: "Red Valley", name: "Hawks", abbr: "RVH", colors: ["#A3201E", "#1E1E1E"], record: { w: 7, l: 4, t: 0 } },
  { id: "lsp", providerId: "demo-t-03", city: "Lakeshore", name: "Pioneers", abbr: "LSP", colors: ["#1F5E3A", "#F2F2F2"], record: { w: 6, l: 5, t: 0 } },
  { id: "mfb", providerId: "demo-t-04", city: "Mesa Flats", name: "Bison", abbr: "MFB", colors: ["#6B3E1F", "#D9A441"], record: { w: 9, l: 2, t: 0 } },
  { id: "nps", providerId: "demo-t-05", city: "North Pines", name: "Stags", abbr: "NPS", colors: ["#24364F", "#9FB4C7"], record: { w: 4, l: 7, t: 0 } },
  { id: "gcr", providerId: "demo-t-06", city: "Gulf Coast", name: "Rays", abbr: "GCR", colors: ["#0E7C86", "#F28C28"], record: { w: 5, l: 6, t: 0 } },
];

const GAMES: Game[] = [
  { id: "2026-w12-hcm-rvh", providerId: "demo-g-1201", competition: "NFL", season: SEASON, seasonType: "regular", week: 12, kickoff: "2026-11-22T18:00:00Z", venue: "Harbor City Stadium", homeTeamId: "hcm", awayTeamId: "rvh", status: "scheduled" },
  { id: "2026-w12-mfb-lsp", providerId: "demo-g-1202", competition: "NFL", season: SEASON, seasonType: "regular", week: 12, kickoff: "2026-11-22T21:25:00Z", venue: "Mesa Flats Field", homeTeamId: "mfb", awayTeamId: "lsp", status: "scheduled" },
  { id: "2026-w12-gcr-nps", providerId: "demo-g-1203", competition: "NFL", season: SEASON, seasonType: "regular", week: 12, kickoff: "2026-11-23T01:20:00Z", venue: "Gulf Coast Dome", homeTeamId: "gcr", awayTeamId: "nps", status: "scheduled" },
  { id: "2026-w11-rvh-mfb", providerId: "demo-g-1104", competition: "NFL", season: SEASON, seasonType: "regular", week: 11, kickoff: "2026-11-15T18:00:00Z", venue: "Red Valley Park", homeTeamId: "rvh", awayTeamId: "mfb", status: "final", score: { home: 20, away: 24 } },
];

const PAST: PastMeeting[] = [
  { gameId: "2025-w14-rvh-hcm", season: 2025, seasonType: "regular", date: "2025-12-07", homeTeamId: "rvh", awayTeamId: "hcm", score: { home: 27, away: 24 } },
  { gameId: "2025-w03-hcm-rvh", season: 2025, seasonType: "regular", date: "2025-09-21", homeTeamId: "hcm", awayTeamId: "rvh", score: { home: 31, away: 17 } },
  { gameId: "2024-wc-hcm-rvh", season: 2024, seasonType: "postseason", date: "2025-01-12", homeTeamId: "hcm", awayTeamId: "rvh", score: { home: 23, away: 20 } },
  { gameId: "2025-w09-lsp-mfb", season: 2025, seasonType: "regular", date: "2025-11-02", homeTeamId: "lsp", awayTeamId: "mfb", score: { home: 13, away: 28 } },
  { gameId: "2025-w16-nps-gcr", season: 2025, seasonType: "regular", date: "2025-12-21", homeTeamId: "nps", awayTeamId: "gcr", score: { home: 17, away: 17 } },
];

const PLAYERS: Player[] = [
  { id: "p-hcm-qb", providerId: "demo-p-101", teamId: "hcm", name: "Cal Whitaker", position: "QB" },
  { id: "p-hcm-rb", providerId: "demo-p-102", teamId: "hcm", name: "Dorian Mays", position: "RB" },
  { id: "p-hcm-wr", providerId: "demo-p-103", teamId: "hcm", name: "Theo Banks", position: "WR" },
  { id: "p-rvh-qb", providerId: "demo-p-201", teamId: "rvh", name: "Jonah Reyes", position: "QB" },
  { id: "p-rvh-rb", providerId: "demo-p-202", teamId: "rvh", name: "Marcus Hale", position: "RB" },
  { id: "p-rvh-wr", providerId: "demo-p-203", teamId: "rvh", name: "Eli Ford", position: "WR" },
  { id: "p-lsp-qb", providerId: "demo-p-301", teamId: "lsp", name: "Owen Pratt", position: "QB" },
  { id: "p-lsp-rb", providerId: "demo-p-302", teamId: "lsp", name: "Isaiah Cole", position: "RB" },
  { id: "p-lsp-wr", providerId: "demo-p-303", teamId: "lsp", name: "Wes Navarro", position: "WR" },
  { id: "p-mfb-qb", providerId: "demo-p-401", teamId: "mfb", name: "Grant Okafor", position: "QB" },
  { id: "p-mfb-rb", providerId: "demo-p-402", teamId: "mfb", name: "Rashad Lyle", position: "RB" },
  { id: "p-mfb-wr", providerId: "demo-p-403", teamId: "mfb", name: "Kai Moreno", position: "WR" },
  { id: "p-nps-qb", providerId: "demo-p-501", teamId: "nps", name: "Brady Lund", position: "QB" },
  { id: "p-nps-rb", providerId: "demo-p-502", teamId: "nps", name: "Tyrell Gaines", position: "RB" },
  { id: "p-nps-wr", providerId: "demo-p-503", teamId: "nps", name: "Simon Achebe", position: "WR" },
  { id: "p-gcr-qb", providerId: "demo-p-601", teamId: "gcr", name: "Dante Silva", position: "QB" },
  { id: "p-gcr-rb", providerId: "demo-p-602", teamId: "gcr", name: "Leo Brandt", position: "RB" },
  { id: "p-gcr-wr", providerId: "demo-p-603", teamId: "gcr", name: "Nate Osei", position: "WR" },
];

const ARTICLES: Article[] = [
  { id: "a1", title: "Sample story: What the Mariners' defense changed after the bye", teamIds: ["hcm"], url: "#demo-article" },
  { id: "a2", title: "Sample story: Hawks' run game is carrying the offense", teamIds: ["rvh"], url: "#demo-article" },
  { id: "a3", title: "Sample story: Bison clinch a winning season with six weeks left", teamIds: ["mfb"], url: "#demo-article" },
  { id: "a4", title: "Sample story: Pioneers searching for answers on third down", teamIds: ["lsp"], url: "#demo-article" },
  { id: "a5", title: "Sample story: Rays and Stags meet with playoff hopes thinning", teamIds: ["gcr", "nps"], url: "#demo-article" },
];

/** Deterministic pseudo-random in [0,1) from a string, so numbers never change between renders. */
function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function range(key: string, lo: number, hi: number, decimals = 1): number {
  const v = lo + seeded(key) * (hi - lo);
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function gamesPlayed(team: Team, period: Period) {
  const total = team.record.w + team.record.l + team.record.t;
  return period === "season" ? total : Math.min(5, total);
}

function buildTeamLine(team: Team, period: Period): TeamStatLine {
  const k = `${team.id}:${period}`;
  // Better records lean toward better numbers so the demo reads plausibly.
  const quality = team.record.w / (team.record.w + team.record.l);
  const tilt = (quality - 0.5) * 8;
  const pass = range(`${k}:pass`, 190, 270);
  const rush = range(`${k}:rush`, 85, 150);
  const pts = Math.round((range(`${k}:pts`, 18, 26) + tilt) * 10) / 10;
  const ptsAllowed = Math.round((range(`${k}:pa`, 18, 26) - tilt) * 10) / 10;
  const gp = gamesPlayed(team, period);
  return {
    teamId: team.id,
    season: SEASON,
    seasonType: "regular",
    period,
    gamesPlayed: gp,
    values: {
      pts_pg: pts,
      pass_yds_pg: pass,
      rush_yds_pg: rush,
      yds_pg: Math.round((pass + rush) * 10) / 10,
      third_down_pct: range(`${k}:3d`, 33, 48),
      red_zone_pct: range(`${k}:rz`, 45, 68),
      pts_allowed_pg: ptsAllowed,
      yds_allowed_pg: range(`${k}:ya`, 300, 370),
      sacks_pg: range(`${k}:sk`, 1.6, 3.4),
      takeaways_pg: range(`${k}:tk`, 0.6, 2.0),
      turnover_diff: Math.round(range(`${k}:td`, -6, 8, 0) * (period === "last5" ? 0.5 : 1)),
      point_diff_pg: Math.round((pts - ptsAllowed) * 10) / 10,
    },
  };
}

function buildPlayerLine(p: Player, period: Period): PlayerStatLine {
  const team = TEAMS.find((t) => t.id === p.teamId)!;
  const gp = gamesPlayed(team, period);
  const k = `${p.id}:${period}`;
  const v: Record<string, number | null> = {
    pass_yds_pg: null, pass_td: null, passer_rating: null, rush_yds_pg: null, rec_yds_pg: null, total_td: null,
  };
  if (p.position === "QB") {
    v.pass_yds_pg = range(`${k}:py`, 205, 290);
    v.pass_td = Math.round(range(`${k}:ptd`, 1.2, 2.4) * gp);
    v.passer_rating = range(`${k}:rt`, 84, 108);
    v.rush_yds_pg = range(`${k}:qry`, 4, 30);
  } else if (p.position === "RB") {
    v.rush_yds_pg = range(`${k}:ry`, 55, 105);
    v.rec_yds_pg = range(`${k}:rcy`, 10, 35);
    v.total_td = Math.round(range(`${k}:td`, 0.4, 1.1) * gp);
  } else {
    v.rec_yds_pg = range(`${k}:wy`, 50, 95);
    v.total_td = Math.round(range(`${k}:wtd`, 0.3, 0.8) * gp);
  }
  return { playerId: p.id, season: SEASON, seasonType: "regular", period, gamesPlayed: gp, values: v };
}

export const demoProvider: StatsProvider = {
  name: "Demo data (fictional teams)",
  isDemo: true,
  freshness(): DataFreshness {
    return { source: "FanPulse demo provider", ingestedAt: new Date(LOADED_AT).toISOString(), staleAfterMinutes: 6 * 60 };
  },
  teams: () => TEAMS,
  team: (id) => TEAMS.find((t) => t.id === id),
  games: () => GAMES,
  game: (id) => GAMES.find((g) => g.id === id),
  teamStats(teamId, season, period) {
    const team = TEAMS.find((t) => t.id === teamId);
    if (!team || season !== SEASON) throw new Error(`No stats for ${teamId} in ${season}`);
    return buildTeamLine(team, period);
  },
  players: (teamId) => PLAYERS.filter((p) => p.teamId === teamId),
  player: (id) => PLAYERS.find((p) => p.id === id),
  playerStats(playerId, season, period) {
    const p = PLAYERS.find((x) => x.id === playerId);
    if (!p || season !== SEASON) throw new Error(`No stats for ${playerId} in ${season}`);
    return buildPlayerLine(p, period);
  },
  headToHead(a, b) {
    return PAST.filter(
      (m) => (m.homeTeamId === a && m.awayTeamId === b) || (m.homeTeamId === b && m.awayTeamId === a),
    ).sort((x, y) => y.date.localeCompare(x.date));
  },
  relatedArticles(teamIds) {
    return ARTICLES.filter((a) => a.teamIds.some((t) => teamIds.includes(t)));
  },
};

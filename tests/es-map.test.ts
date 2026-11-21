import { describe, expect, it } from "vitest";
import {
  completedFor, currentWeek, gameId, headToHead, mapGame, mapLeaders, mapStandings, mapTeam, nextGameFor, recentResults, parseSeason, passerRating, pickSpotlight, playerValues,
  teamBoxValues, teamSeasonValues, teamValuesFromScores, type RawBoxscore, type RawGame, type RawPlayerStats,
} from "@/lib/data/es/map";

// Small fixtures in the ES Stats API's response shapes (values are test inputs, not real stats).
const g = (id: number, week: number, away: string, home: string, as: number | null, hs: number | null, status = "COMPLETED", season = "2026-2027-regular"): RawGame => ({
  game_id: id, season, week, start_time: `2026-10-${String(id % 28 + 1).padStart(2, "0")}T17:00:00+00:00`, date: "2026-10-01",
  away, home, away_score: as, home_score: hs, status, venue: "Test Field",
});

describe("ES Stats mapping: seasons, teams, games", () => {
  it("parses season slugs", () => {
    expect(parseSeason("2026-2027-regular")).toEqual({ year: 2026, type: "regular" });
    expect(parseSeason("2026-2027-playoff")).toEqual({ year: 2026, type: "postseason" });
  });

  it("builds readable, stable game ids", () => {
    expect(gameId({ season: "2026-2027-regular", week: 12, home: "LA", away: "GB" })).toBe("2026-w12-la-gb");
  });

  it("maps statuses and only keeps scores for final games", () => {
    expect(mapGame(g(1, 3, "PIT", "CIN", 18, 38)).status).toBe("final");
    expect(mapGame(g(1, 3, "PIT", "CIN", 18, 38)).score).toEqual({ home: 38, away: 18 });
    const upcoming = mapGame(g(2, 12, "GB", "LA", null, null, "UNPLAYED"));
    expect(upcoming.status).toBe("scheduled");
    expect(upcoming.score).toBeUndefined();
  });

  it("uses the provider logo and falls back on bad colours", () => {
    const t = mapTeam({ team_id: 76, abbr: "ARI", city: "Arizona", name: "Cardinals", colors: ["#97233f", "nope"], logo: "https://x/ARI.svg" }, { w: 1, l: 2, t: 0 });
    expect(t.id).toBe("ari");
    expect(t.logoUrl).toBe("https://x/ARI.svg");
    expect(t.colors).toEqual(["#97233f", "#ffffff"]);
  });

  it("current week is the earliest week with an unplayed game", () => {
    expect(currentWeek([g(1, 10, "A", "B", 1, 2), g(2, 11, "A", "B", 1, 2), g(3, 11, "C", "D", null, null, "UNPLAYED"), g(4, 12, "A", "B", null, null, "UNPLAYED")])).toBe(11);
    expect(currentWeek([g(1, 18, "A", "B", 1, 2)])).toBe(18);
  });

  it("head-to-head covers both home/away orders, newest first, finals only", () => {
    const games = [g(1, 3, "PIT", "CIN", 30, 27), g(9, 10, "CIN", "PIT", 38, 18), g(5, 6, "PIT", "BAL", 10, 20), g(10, 14, "PIT", "CIN", null, null, "UNPLAYED")];
    const h = headToHead(games, "PIT", "CIN");
    expect(h.map((m) => m.score)).toEqual([{ home: 18, away: 38 }, { home: 27, away: 30 }]);
  });
});

describe("ES Stats mapping: team metrics", () => {
  it("season values are totals divided by games played", () => {
    const v = teamSeasonValues({
      team: "BUF", games_played: 9, stats: {
        "standings.pointsFor": 287, "standings.pointsAgainst": 199, "miscellaneous.offenseYds": 3480, "passing.passNetYards": 2000,
        "rushing.rushYards": 1480, "miscellaneous.thirdDownsPct": 41.0, "tackles.sacks": 21, "interceptions.interceptions": 6,
        "fumbles.fumOppRec": 5, "passing.passInt": 7, "fumbles.fumLost": 4,
      },
    });
    expect(v.gamesPlayed).toBe(9);
    expect(v.values.pts_pg).toBe(31.9);
    expect(v.values.pts_allowed_pg).toBe(22.1);
    expect(v.values.yds_pg).toBe(386.7);
    expect(v.values.third_down_pct).toBe(41);
    expect(v.values.takeaways_pg).toBe(1.2);
    expect(v.values.turnover_diff).toBe(0);
    expect(v.values.point_diff_pg).toBe(9.8);
  });

  it("never estimates metrics the API does not provide", () => {
    const v = teamSeasonValues({ team: "X", games_played: 5, stats: { "standings.pointsFor": 100 } });
    expect(v.values.red_zone_pct).toBeNull();
    expect(v.values.yds_allowed_pg).toBeNull();
    expect(v.values.yds_pg).toBeNull();
    expect(v.values.turnover_diff).toBeNull();
  });

  it("last-5 points come from final scores, home or away", () => {
    const recent = completedFor([g(1, 1, "PIT", "CIN", 10, 20), g(2, 2, "CIN", "BAL", 30, 7), g(3, 3, "TB", "BAL", 3, 3)], "CIN");
    const v = teamValuesFromScores(recent, "CIN");
    expect(v.gamesPlayed).toBe(2);
    expect(v.values.pts_pg).toBe(25); // 20 + 30
    expect(v.values.pts_allowed_pg).toBe(8.5); // 10 + 7
    expect(v.values.point_diff_pg).toBe(16.5);
  });

  it("box-score metrics use the opponent's line for yards allowed", () => {
    const box = (mine: number, theirs: number, third: [number, number]): RawBoxscore => ({
      game: g(1, 1, "A", "B", 0, 0),
      teams: [
        { team: "CIN", opp: "PIT", home: true, stats: { "miscellaneous.offenseYds": mine, "miscellaneous.thirdDowns": third[0], "miscellaneous.thirdDownsAtt": third[1] } },
        { team: "PIT", opp: "CIN", home: false, stats: { "miscellaneous.offenseYds": theirs } },
      ],
      players: [],
    });
    const v = teamBoxValues([box(484, 222, [6, 12]), box(300, 350, [4, 8])], "CIN");
    expect(v.gamesPlayed).toBe(2);
    expect(v.values.yds_pg).toBe(392);
    expect(v.values.yds_allowed_pg).toBe(286);
    expect(v.values.third_down_pct).toBe(50); // 10 of 20
  });
});

describe("ES Stats mapping: players", () => {
  const p = (id: number, pos: string, stats: Record<string, number>): RawPlayerStats => ({ player_id: id, name: `P${id}`, position: pos, team: "PIT", games_played: 9, stats });

  it("spotlight picks the yardage leader at QB, RB and WR", () => {
    const picks = pickSpotlight([
      p(1, "QB", { "passing.passYards": 2014 }), p(2, "QB", { "passing.passYards": 30 }),
      p(3, "RB", { "rushing.rushYards": 500 }), p(4, "RB", { "rushing.rushYards": 700 }),
      p(5, "WR", { "receiving.recYards": 0 }), p(6, "TE", { "receiving.recYards": 900 }),
    ]);
    expect(picks.map((x) => x.player_id)).toEqual([1, 4]); // no WR with yards; TE is not a WR
  });

  it("QB values use the API rating when given", () => {
    const v = playerValues("QB", { "passing.passYards": 2014, "passing.passTD": 15, "rushing.rushYards": 22 }, 9, 86.4);
    expect(v.pass_yds_pg).toBe(223.8);
    expect(v.pass_td).toBe(15);
    expect(v.passer_rating).toBe(86.4);
    expect(v.total_td).toBeNull();
  });

  it("computes the NFL passer rating from totals", () => {
    expect(passerRating(20, 30, 300, 3, 0)).toBe(132.6); // (1.833 + 1.75 + 2 + 2.375) / 6 * 100
    expect(passerRating(0, 0, 0, 0, 0)).toBeNull();
    expect(passerRating(30, 30, 600, 10, 0)).toBe(158.3); // capped at the maximum
  });
});

describe("ES Stats mapping: standings, leaders, results", () => {
  it("maps division and rank by team", () => {
    const m = mapStandings([{ team: "BUF", conference: "AFC", division: "AFC East", division_rank: 1 }]);
    expect(m.get("BUF")).toEqual({ conference: "AFC", division: "AFC East", divisionRank: 1 });
  });

  it("maps a leader board to internal team ids, top 5 only", () => {
    const raw = { metric: "passing.passYards", label: "Passing yards", leaders: Array.from({ length: 7 }, (_, i) => ({ player_id: i, name: `QB${i}`, team: "GB", position: "QB", rank: i + 1, value: 3000 - i })) };
    const b = mapLeaders(raw, "Passing yards");
    expect(b.rows).toHaveLength(5);
    expect(b.rows[0]).toEqual({ rank: 1, playerName: "QB0", teamId: "gb", value: 3000 });
  });

  it("recent results read from the team's side, newest first, capped", () => {
    const games = [g(1, 1, "PIT", "CIN", 30, 27), g(9, 10, "PIT", "CIN", 18, 38), g(5, 6, "PIT", "BAL", 20, 20), g(10, 14, "CLE", "PIT", null, null, "UNPLAYED")];
    const r = recentResults(games, "PIT", 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ home: false, opponentId: "cin", pf: 18, pa: 38, result: "L" });
    expect(r[1]).toMatchObject({ opponentId: "bal", result: "T" });
  });

  it("next game is the soonest unplayed one", () => {
    const games = [g(9, 10, "PIT", "CIN", 18, 38), g(12, 13, "PIT", "BAL", null, null, "UNPLAYED"), g(11, 12, "CLE", "PIT", null, null, "UNPLAYED")];
    expect(nextGameFor(games, "PIT")?.game_id).toBe(11);
    expect(nextGameFor(games, "NYG")).toBeUndefined();
  });
});

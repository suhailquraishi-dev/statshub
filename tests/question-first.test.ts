import { describe, expect, it } from "vitest";
import { demoProvider as p } from "@/lib/data/demo-provider";
import { GAME_METRICS, teamMetric } from "@/lib/data/metrics";
import { compareGame, compareRow, keyNumbers, tallySentence, type ComparisonRow } from "@/lib/stats/compare";
import { gameValues, type RawBoxscore } from "@/lib/data/es/map";
import { FanPulseError, freshDB, resetDB, setVerdict, signIn } from "@/lib/store/store";

const home = p.team("hcm")!; // Mariners
const away = p.team("rvh")!; // Hawks
const row = (code: string, h: number | null, a: number | null): ComparisonRow => {
  const metric = teamMetric(code);
  const s = (value: number | null) => ({ metric, season: 2026, seasonType: "regular" as const, period: "season" as const, value, gamesPlayed: 9 });
  return compareRow(metric, s(h), s(a));
};

describe("honest comparison summary", () => {
  it("says how many of the available comparisons a team leads", () => {
    const rows = [row("pts_pg", 30, 20), row("pts_allowed_pg", 18, 25), row("yds_pg", 300, 380), row("third_down_pct", 41, 40.8)];
    expect(tallySentence({ rows }, home, away)).toBe("The Mariners lead 2 of the 4 available comparisons; the Hawks lead 1.");
  });

  it("never reads as a bigger lead when stats are missing", () => {
    const rows = [row("pts_pg", 32, 20.4), row("pts_allowed_pg", 18.4, 24.6), row("yds_pg", null, null), row("yds_allowed_pg", null, null), row("turnover_diff", null, null)];
    expect(tallySentence({ rows }, home, away)).toBe("The Mariners lead both available comparisons. 3 stats aren't available for this period yet.");
  });

  it("handles one, none and split", () => {
    expect(tallySentence({ rows: [row("pts_pg", 20, 30), row("yds_pg", null, 300)] }, home, away)).toBe("The Hawks lead the only available comparison. 1 stat isn't available for this period yet.");
    expect(tallySentence({ rows: [row("pts_pg", null, null)] }, home, away)).toBe("No comparisons are available for this period yet.");
    expect(tallySentence({ rows: [row("pts_pg", 30, 20), row("yds_pg", 300, 380)] }, home, away)).toBe("The teams split the 2 available comparisons, 1 each.");
  });

  it("key numbers are the two widest available gaps, never missing or even rows", () => {
    const rows = [row("pts_pg", 30, 29.9), row("yds_pg", 400, 300), row("pts_allowed_pg", 10, 30), row("third_down_pct", null, 40), row("sacks_pg", 3, 2.5)];
    expect(keyNumbers({ rows }).map((r) => r.metric.code)).toEqual(["pts_allowed_pg", "yds_pg"]);
  });
});

describe("postgame", () => {
  it("compares one game's own numbers and explains them as this game", () => {
    const c = compareGame(home, away, 2026, "regular", GAME_METRICS, { g_pts: 20, g_yds: 310, g_sacks: 1 }, { g_pts: 24, g_yds: 280, g_sacks: 4 });
    expect(c.periodLabel).toBe("This game");
    expect(c.rows.map((r) => r.metric.code)).toEqual(GAME_METRICS.map((m) => m.code)); // order never changes
    expect(c.rows.find((r) => r.metric.code === "g_pts")!.edge).toBe("away");
    expect(c.rows.find((r) => r.metric.code === "g_rush_yds")!.home).toBeNull();
    expect(c.insights[0].startsWith("In this game")).toBe(true);
    expect(c.insights.some((s) => s.startsWith("Small sample"))).toBe(false);
  });

  it("reads a team's game line from the box score", () => {
    const box: RawBoxscore = {
      game: { game_id: 1, season: "2026-2027-regular", week: 10, start_time: "2026-11-16T01:20:00+00:00", date: "2026-11-15", away: "PIT", home: "CIN", away_score: 18, home_score: 38, status: "COMPLETED", venue: "X" },
      teams: [
        { team: "CIN", opp: "PIT", home: true, stats: { "standings.pointsFor": 38, "miscellaneous.offenseYds": 484, "miscellaneous.thirdDowns": 6, "miscellaneous.thirdDownsAtt": 12, "interceptions.interceptions": 1, "fumbles.fumOppRec": 1 } },
        { team: "PIT", opp: "CIN", home: false, stats: { "miscellaneous.offenseYds": 222 } },
      ],
      players: [],
    };
    expect(gameValues(box, "CIN")).toMatchObject({ g_pts: 38, g_yds: 484, g_third_down_pct: 50, g_takeaways: 2, g_sacks: null });
    expect(gameValues(box, "PIT")).toMatchObject({ g_pts: 18, g_yds: 222, g_third_down_pct: null });
    expect(gameValues(box, "BUF")).toBeNull();
  });

  it("demo final games have game numbers that match the score", () => {
    const gs = p.gameStats("2026-w11-rvh-mfb")!;
    expect(gs.home.g_pts).toBe(20);
    expect(gs.away.g_pts).toBe(24);
    expect(p.gameStats("2026-w12-hcm-rvh")).toBeNull(); // not played yet
  });

  it("only editors can publish a verdict, with a sensible length", () => {
    resetDB();
    freshDB();
    const fan = signIn("fan@example.com", "Fan");
    const ed = signIn("ed@essentiallysports.com", "Ed Editor");
    expect(() => setVerdict(fan.id, "d105", "The Bison defense decided it with two late stops.")).toThrow(FanPulseError);
    expect(() => setVerdict(ed.id, "d105", "Too short")).toThrow(FanPulseError);
    const d = setVerdict(ed.id, "d105", "The Bison defense decided it with two late stops.");
    expect(d.verdict).toMatchObject({ by: "Ed Editor" });
  });
});

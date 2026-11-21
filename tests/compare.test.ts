import { describe, expect, it } from "vitest";
import { demoProvider as p } from "@/lib/data/demo-provider";
import { teamMetric, QUICK_STAT_CODES } from "@/lib/data/metrics";
import { assertCompatible, compareRow, compareTeams, IncompatibleComparisonError } from "@/lib/stats/compare";

const home = p.team("hcm")!;
const away = p.team("rvh")!;
const sample = (code: string, value: number, over: Partial<{ season: number; period: "season" | "last5"; seasonType: "regular" | "postseason" }> = {}) => ({
  metric: teamMetric(code), season: 2026, seasonType: "regular" as const, period: "season" as const, value, gamesPlayed: 11, ...over,
});

describe("comparison engine", () => {
  it("credits the lower value when lower is better", () => {
    const r = compareRow(teamMetric("pts_allowed_pg"), sample("pts_allowed_pg", 18), sample("pts_allowed_pg", 24));
    expect(r.edge).toBe("home");
  });

  it("calls near-identical values even", () => {
    expect(compareRow(teamMetric("pts_pg"), sample("pts_pg", 24.0), sample("pts_pg", 24.2)).edge).toBe("even");
  });

  it("rejects mixed seasons, periods and season types", () => {
    expect(() => assertCompatible(sample("pts_pg", 1), sample("pts_pg", 1, { season: 2025 }))).toThrow(IncompatibleComparisonError);
    expect(() => assertCompatible(sample("pts_pg", 1), sample("pts_pg", 1, { period: "last5" }))).toThrow(IncompatibleComparisonError);
    expect(() => assertCompatible(sample("pts_pg", 1), sample("pts_pg", 1, { seasonType: "postseason" }))).toThrow(IncompatibleComparisonError);
    expect(() => assertCompatible(sample("pts_pg", 1), sample("yds_pg", 1))).toThrow(IncompatibleComparisonError);
  });

  it("explanations are built from the displayed numbers and change with the period (F02)", () => {
    const season = compareTeams(home, away, p.teamStats("hcm", 2026, "season"), p.teamStats("rvh", 2026, "season"), QUICK_STAT_CODES);
    const last5 = compareTeams(home, away, p.teamStats("hcm", 2026, "last5"), p.teamStats("rvh", 2026, "last5"), QUICK_STAT_CODES);
    expect(season.insights.join(" ")).toMatch(/^This season/);
    expect(last5.insights.join(" ")).toMatch(/^Over their last 5 games/);
    expect(last5.insights.some((s) => s.startsWith("Small sample"))).toBe(true);
    // Every number quoted in an insight appears in the table.
    for (const c of [season, last5]) {
      const shown = new Set(c.rows.flatMap((r) => [r.homeText, r.awayText]));
      for (const s of c.insights) for (const n of s.match(/[+-]?\d+(\.\d+)?%?(?=,| for|\.$)/g) ?? []) expect(shown.has(n)).toBe(true);
    }
  });

  it("labels the sample size", () => {
    const c = compareTeams(home, away, p.teamStats("hcm", 2026, "last5"), p.teamStats("rvh", 2026, "last5"), ["pts_pg"]);
    expect(c.sample).toEqual({ home: 5, away: 5 });
    expect(c.periodLabel).toBe("Last 5 games");
  });
});

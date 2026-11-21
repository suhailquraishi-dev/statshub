import type { MetricDef } from "./types";

export const TEAM_METRICS: MetricDef[] = [
  { code: "pts_pg", label: "Points per game", short: "Points / game", unit: "points", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "How much a team scores in a typical game." },
  { code: "yds_pg", label: "Total yards per game", short: "Yards / game", unit: "yards", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "How far the offense moves the ball each game." },
  { code: "pass_yds_pg", label: "Passing yards per game", short: "Pass yards / game", unit: "yards", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "Yards gained through the air each game." },
  { code: "rush_yds_pg", label: "Rushing yards per game", short: "Rush yards / game", unit: "yards", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "Yards gained on the ground each game." },
  { code: "third_down_pct", label: "Third-down conversion rate", short: "3rd-down rate", unit: "percent", aggregation: "rate", higherIsBetter: true, category: "offense", decimals: 1, meaning: "How often the offense keeps a drive alive on third down." },
  { code: "red_zone_pct", label: "Red-zone touchdown rate", short: "Red-zone TD rate", unit: "percent", aggregation: "rate", higherIsBetter: true, category: "offense", decimals: 1, meaning: "How often a trip inside the 20 ends in a touchdown." },
  { code: "pts_allowed_pg", label: "Points allowed per game", short: "Points allowed / game", unit: "points", aggregation: "per_game", higherIsBetter: false, category: "defense", decimals: 1, meaning: "How much the defense gives up in a typical game. Lower is better." },
  { code: "yds_allowed_pg", label: "Yards allowed per game", short: "Yards allowed / game", unit: "yards", aggregation: "per_game", higherIsBetter: false, category: "defense", decimals: 1, meaning: "How far opponents move the ball each game. Lower is better." },
  { code: "sacks_pg", label: "Sacks per game", short: "Sacks / game", unit: "count", aggregation: "per_game", higherIsBetter: true, category: "defense", decimals: 1, meaning: "How often the defense brings down the quarterback." },
  { code: "takeaways_pg", label: "Takeaways per game", short: "Takeaways / game", unit: "count", aggregation: "per_game", higherIsBetter: true, category: "defense", decimals: 1, meaning: "Interceptions plus recovered fumbles each game." },
  { code: "turnover_diff", label: "Turnover differential", short: "Turnover diff.", unit: "count", aggregation: "total", higherIsBetter: true, category: "form", decimals: 0, meaning: "Takeaways minus giveaways over the period. Positive is good." },
  { code: "point_diff_pg", label: "Point differential per game", short: "Point diff. / game", unit: "points", aggregation: "per_game", higherIsBetter: true, category: "form", decimals: 1, meaning: "Average winning or losing margin." },
];

export const PLAYER_METRICS: MetricDef[] = [
  { code: "pass_yds_pg", label: "Passing yards per game", short: "Pass yds / game", unit: "yards", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "Yards thrown for each game." },
  { code: "pass_td", label: "Passing touchdowns", short: "Pass TD", unit: "count", aggregation: "total", higherIsBetter: true, category: "offense", decimals: 0, meaning: "Touchdown passes over the period." },
  { code: "passer_rating", label: "Passer rating", short: "Rating", unit: "rating", aggregation: "rate", higherIsBetter: true, category: "offense", decimals: 1, meaning: "The NFL's standard passing efficiency score (0 to 158.3)." },
  { code: "rush_yds_pg", label: "Rushing yards per game", short: "Rush yds / game", unit: "yards", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "Yards run for each game." },
  { code: "rec_yds_pg", label: "Receiving yards per game", short: "Rec yds / game", unit: "yards", aggregation: "per_game", higherIsBetter: true, category: "offense", decimals: 1, meaning: "Yards caught for each game." },
  { code: "total_td", label: "Total touchdowns", short: "TD", unit: "count", aggregation: "total", higherIsBetter: true, category: "offense", decimals: 0, meaning: "Rushing plus receiving touchdowns." },
];

const byCode = new Map<string, MetricDef>();
for (const m of [...TEAM_METRICS, ...PLAYER_METRICS]) if (!byCode.has(m.code)) byCode.set(m.code, m);

export function teamMetric(code: string): MetricDef {
  const m = TEAM_METRICS.find((x) => x.code === code);
  if (!m) throw new Error(`Unknown team metric: ${code}`);
  return m;
}

export function playerMetric(code: string): MetricDef {
  const m = PLAYER_METRICS.find((x) => x.code === code);
  if (!m) throw new Error(`Unknown player metric: ${code}`);
  return m;
}

export const QUICK_STAT_CODES = ["pts_pg", "pts_allowed_pg", "yds_pg", "yds_allowed_pg", "turnover_diff", "third_down_pct"];

export const PERIOD_LABEL: Record<"season" | "last5", string> = {
  season: "Full season",
  last5: "Last 5 games",
};

export function formatValue(m: MetricDef, v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  const n = v.toFixed(m.decimals);
  if (m.unit === "percent") return `${n}%`;
  if (m.code === "turnover_diff" && v > 0) return `+${n}`;
  if (m.code === "point_diff_pg" && v > 0) return `+${n}`;
  return n;
}

export function unitWord(m: MetricDef): string {
  switch (m.aggregation) {
    case "per_game": return "per game";
    case "rate": return m.unit === "percent" ? "rate" : "rating";
    case "total": return "total";
  }
}

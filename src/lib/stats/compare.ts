import type { MetricDef, Period, SeasonType, Team, TeamStatLine } from "@/lib/data/types";
import { formatValue, PERIOD_LABEL, teamMetric, unitWord } from "@/lib/data/metrics";

export class IncompatibleComparisonError extends Error {
  constructor(reason: string) {
    super(`Incompatible comparison: ${reason}`);
    this.name = "IncompatibleComparisonError";
  }
}

export interface ComparableSample {
  metric: MetricDef;
  season: number;
  seasonType: SeasonType;
  period: Period;
  value: number | null;
  gamesPlayed: number;
}

/** Refuse to compare across seasons, season types, periods or units (PRD §7, §9). */
export function assertCompatible(a: ComparableSample, b: ComparableSample): void {
  if (a.metric.code !== b.metric.code) throw new IncompatibleComparisonError("different metrics");
  if (a.metric.unit !== b.metric.unit) throw new IncompatibleComparisonError("different units");
  if (a.metric.aggregation !== b.metric.aggregation) throw new IncompatibleComparisonError("per-game vs total");
  if (a.season !== b.season) throw new IncompatibleComparisonError("different seasons");
  if (a.seasonType !== b.seasonType) throw new IncompatibleComparisonError("regular season vs postseason");
  if (a.period !== b.period) throw new IncompatibleComparisonError("different periods");
}

export type Edge = "home" | "away" | "even";

export interface ComparisonRow {
  metric: MetricDef;
  home: number | null;
  away: number | null;
  homeText: string;
  awayText: string;
  edge: Edge;
  /** Absolute gap, in the metric's unit. */
  gap: number;
  /** Gap relative to the average of the two, 0..1+. Used to pick headline insights. */
  relGap: number;
}

export interface Comparison {
  period: Period;
  periodLabel: string;
  season: number;
  seasonType: SeasonType;
  sample: { home: number; away: number };
  rows: ComparisonRow[];
  insights: string[];
}

/** Within 2% of each other counts as even, so trivial gaps are not oversold. */
const EVEN_THRESHOLD = 0.02;

export function compareRow(metric: MetricDef, home: ComparableSample, away: ComparableSample): ComparisonRow {
  assertCompatible(home, away);
  const h = home.value;
  const a = away.value;
  let edge: Edge = "even";
  let gap = 0;
  let relGap = 0;
  if (h !== null && a !== null) {
    gap = Math.abs(h - a);
    const scale = Math.max(Math.abs((h + a) / 2), 1);
    relGap = gap / scale;
    if (relGap > EVEN_THRESHOLD) {
      const homeHigher = h > a;
      edge = homeHigher === metric.higherIsBetter ? "home" : "away";
    }
  }
  return { metric, home: h, away: a, homeText: formatValue(metric, h), awayText: formatValue(metric, a), edge, gap, relGap };
}

function sample(line: TeamStatLine, code: string): ComparableSample {
  const metric = teamMetric(code);
  return {
    metric,
    season: line.season,
    seasonType: line.seasonType,
    period: line.period,
    value: line.values[code] ?? null,
    gamesPlayed: line.gamesPlayed,
  };
}

export function compareTeams(
  homeTeam: Team,
  awayTeam: Team,
  homeLine: TeamStatLine,
  awayLine: TeamStatLine,
  codes: string[],
): Comparison {
  const rows = codes.map((c) => compareRow(teamMetric(c), sample(homeLine, c), sample(awayLine, c)));
  return {
    period: homeLine.period,
    periodLabel: PERIOD_LABEL[homeLine.period],
    season: homeLine.season,
    seasonType: homeLine.seasonType,
    sample: { home: homeLine.gamesPlayed, away: awayLine.gamesPlayed },
    rows,
    insights: explain(homeTeam, awayTeam, rows, homeLine.period, homeLine.gamesPlayed, awayLine.gamesPlayed),
  };
}

/**
 * Plain-English explanation built only from the numbers in `rows`, so the
 * text and the comparison always change together (PRD F02).
 */
export function explain(
  home: Team,
  away: Team,
  rows: ComparisonRow[],
  period: Period,
  homeGames: number,
  awayGames: number,
): string[] {
  const window = period === "season" ? "This season" : "Over their last 5 games";
  const out: string[] = [];
  const ranked = rows
    .filter((r) => r.edge !== "even" && r.home !== null && r.away !== null)
    .sort((x, y) => y.relGap - x.relGap)
    .slice(0, 2);

  for (const r of ranked) {
    const leader = r.edge === "home" ? home : away;
    const trailer = r.edge === "home" ? away : home;
    const lv = r.edge === "home" ? r.homeText : r.awayText;
    const tv = r.edge === "home" ? r.awayText : r.homeText;
    const label = r.metric.label.toLowerCase();
    const better = r.metric.higherIsBetter ? "ahead" : "better (lower)";
    out.push(`${window}, the ${leader.name} are ${better} in ${label}: ${lv}, against ${tv} for the ${trailer.name}.`);
  }

  const evens = rows.filter((r) => r.edge === "even" && r.home !== null);
  if (evens.length > 0) {
    out.push(`The teams are about even in ${evens.map((r) => r.metric.label.toLowerCase()).join(" and ")}.`);
  }
  if (out.length === 0) out.push("Not enough data to compare these teams for this period.");

  const smallest = Math.min(homeGames, awayGames);
  if (smallest < 6) {
    out.push(`Small sample: ${smallest} game${smallest === 1 ? "" : "s"} per team, so one big game moves these numbers a lot.`);
  }
  return out;
}

export function describeSample(m: MetricDef, period: Period, games: number): string {
  return `${PERIOD_LABEL[period]} · ${games} game${games === 1 ? "" : "s"} · ${unitWord(m)}`;
}

import { describe, expect, it } from "vitest";
import { demoProvider } from "@/lib/data/demo-provider";
import { findSignals } from "@/lib/stats/signals";
import { rankScore, RANK_WEIGHTS } from "@/lib/stats/ranking";
import { formatValue, teamMetric } from "@/lib/data/metrics";

describe("signal engine", () => {
  it("only reports real changes, quoting the provider's numbers", () => {
    const sigs = findSignals(demoProvider);
    for (const s of sigs) {
      expect(s.relChange).toBeGreaterThanOrEqual(0.08);
      const m = teamMetric(s.metricCode);
      expect(s.summary).toContain(formatValue(m, s.seasonValue));
      expect(s.summary).toContain(formatValue(m, s.recentValue));
      expect(s.draftOptions.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("ranking", () => {
  it("weights sum to 1", () => {
    expect(Object.values(RANK_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("prefers fresh, active, diverse threads and applies penalties", () => {
    const now = Date.parse("2026-11-21T12:00:00Z");
    const base = { recentComments: 10, distinctAuthors: 8, votes: 40, evidenceComments: 3, relevance: 0.5, significance: 0.5, createdAt: "2026-11-21T10:00:00Z", featured: false };
    const quiet = { ...base, recentComments: 0, distinctAuthors: 0, votes: 0, evidenceComments: 0 };
    const old = { ...base, createdAt: "2026-11-10T10:00:00Z" };
    expect(rankScore(base, now)).toBeGreaterThan(rankScore(quiet, now));
    expect(rankScore(base, now)).toBeGreaterThan(rankScore(old, now));
    expect(rankScore({ ...base, penalty: 0.3 }, now)).toBeLessThan(rankScore(base, now));
  });
});

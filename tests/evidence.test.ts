import { describe, expect, it } from "vitest";
import { demoProvider } from "@/lib/data/demo-provider";
import type { StatsProvider } from "@/lib/data/provider";
import { createEvidenceSnapshot, evidenceState } from "@/lib/stats/evidence";
import { IncompatibleComparisonError } from "@/lib/stats/compare";

const req = { kind: "team" as const, metricCode: "pts_pg", period: "last5" as const, season: 2026, entityIds: ["hcm", "rvh"], contextGameId: "2026-w12-hcm-rvh" };

describe("evidence snapshots (PRD §7)", () => {
  it("stores the full contract", () => {
    const s = createEvidenceSnapshot(demoProvider, req);
    expect(s.snapshotId).toMatch(/^ev_/);
    expect(s).toMatchObject({ metricCode: "pts_pg", unit: "points", aggregation: "per_game", competition: "NFL", season: 2026, seasonType: "regular", period: "last5", calcVersion: "compare-v1" });
    expect(s.entities.map((e) => e.providerId)).toEqual(["demo-t-01", "demo-t-02"]);
    expect(s.entities.every((e) => e.sampleSize === 5)).toBe(true);
    expect(s.ingestedAt).toBeTruthy();
  });

  it("is immutable", () => {
    const s = createEvidenceSnapshot(demoProvider, req);
    expect(() => { (s.entities[0] as { value: number | null }).value = 99; }).toThrow();
    expect(Object.isFrozen(s)).toBe(true);
  });

  it("rejects bad requests", () => {
    expect(() => createEvidenceSnapshot(demoProvider, { ...req, entityIds: ["hcm", "hcm"] })).toThrow(IncompatibleComparisonError);
    expect(() => createEvidenceSnapshot(demoProvider, { ...req, entityIds: [] })).toThrow(IncompatibleComparisonError);
    // A receiver has no passing yards: refuse instead of showing a blank.
    expect(() => createEvidenceSnapshot(demoProvider, { kind: "player", metricCode: "pass_yds_pg", period: "season", season: 2026, entityIds: ["p-hcm-wr"] })).toThrow(IncompatibleComparisonError);
  });

  it("flags a provider correction as superseded", () => {
    const s = createEvidenceSnapshot(demoProvider, req);
    expect(evidenceState(demoProvider, s)).toBe("current");
    const corrected: StatsProvider = {
      ...demoProvider,
      teamStats(id, season, period) {
        const line = demoProvider.teamStats(id, season, period);
        return id === "hcm" ? { ...line, values: { ...line.values, pts_pg: (line.values.pts_pg ?? 0) + 3 } } : line;
      },
    };
    expect(evidenceState(corrected, s)).toBe("superseded");
  });
});

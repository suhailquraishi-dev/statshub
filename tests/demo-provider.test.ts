import { describe, expect, it } from "vitest";
import { demoProvider as p } from "@/lib/data/demo-provider";

describe("demo provider: home sections", () => {
  it("every team has a division and a rank inside it", () => {
    for (const t of p.teams()) {
      expect(t.division).toBeTruthy();
      expect(t.divisionRank).toBeGreaterThanOrEqual(1);
    }
    const east = p.teams().filter((t) => t.division === "Demo East").map((t) => t.divisionRank).sort();
    expect(east[0]).toBe(1);
  });

  it("leaders are sorted, ranked from 1, and come from demo players", () => {
    const boards = p.leaders();
    expect(boards.length).toBeGreaterThan(0);
    for (const b of boards) {
      expect(b.rows[0].rank).toBe(1);
      for (let i = 1; i < b.rows.length; i++) expect(b.rows[i - 1].value).toBeGreaterThanOrEqual(b.rows[i].value);
      for (const r of b.rows) expect(p.team(r.teamId)).toBeTruthy();
    }
  });

  it("recent results are from the team's side and the next game is unplayed", () => {
    const r = p.recentResults("mfb", 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatchObject({ opponentId: "rvh", pf: 24, pa: 20, result: "W", home: false });
    expect(p.nextGame("mfb")?.status).toBe("scheduled");
  });
});

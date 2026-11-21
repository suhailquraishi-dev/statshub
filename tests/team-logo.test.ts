import { describe, expect, it } from "vitest";
import { demoProvider as p } from "@/lib/data/demo-provider";
import { contrast, DEMO_EMBLEMS, logoColors } from "@/components/TeamLogo";

describe("team logos", () => {
  it("every demo team has a drawn emblem", () => {
    for (const t of p.teams()) expect(DEMO_EMBLEMS).toContain(t.id);
  });

  it("emblem reads against the shield (at least 3:1)", () => {
    for (const t of p.teams()) {
      const { ink } = logoColors(t.colors);
      expect(contrast(t.colors[0], ink)).toBeGreaterThanOrEqual(3);
    }
  });

  it("falls back to white when the secondary colour is too close", () => {
    expect(logoColors(["#A3201E", "#1E1E1E"]).ink).toBe("#ffffff");
    expect(logoColors(["#0B3D5C", "#E8B23A"]).ink).toBe("#E8B23A");
  });
});

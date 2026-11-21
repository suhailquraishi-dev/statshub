import { beforeEach, describe, expect, it } from "vitest";
import {
  addComment, attachEvidence, createDiscussion, FanPulseError, idempotent, listComments, listDiscussions,
  moderateComment, moderateDiscussion, moderationQueue, pollResults, report, resetDB, signIn, toggleReaction, vote,
} from "@/lib/store/store";
import { createEvidenceSnapshot } from "@/lib/stats/evidence";
import { demoProvider } from "@/lib/data/demo-provider";

beforeEach(() => resetDB());

const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as FanPulseError).code; } return "ok"; };

describe("polls (F04)", () => {
  it("counts one vote per account, and a re-vote changes the choice not the total", () => {
    const u = signIn("fan@example.com", "Pat");
    vote(u.id, "d101", "o1");
    vote(u.id, "d101", "o1");
    let r = vote(u.id, "d101", "o2");
    expect(r.total).toBe(1);
    expect(r.myVote).toBe("o2");
    const u2 = signIn("fan2@example.com", "Sam");
    r = vote(u2.id, "d101", "o2");
    expect(r.total).toBe(2);
    expect(r.options.find((o) => o.id === "o2")!.votes).toBe(2);
  });

  it("percentages always add up to 100", () => {
    for (const [i, opt] of ["o1", "o2", "o3"].entries()) vote(signIn(`v${i}@x.com`, `Voter ${i}`).id, "d101", opt);
    expect(pollResults("d101").options.reduce((a, o) => a + o.pct, 0)).toBe(100);
  });

  it("anonymous visitors can read results but not vote", () => {
    expect(pollResults("d101").total).toBe(0);
    expect(code(() => vote(null, "d101", "o1"))).toBe("unauthorized");
  });

  it("locked discussions refuse votes and comments", () => {
    const ed = signIn("ed@essentiallysports.com", "Editor");
    const u = signIn("fan@example.com", "Pat");
    moderateDiscussion(ed.id, "d101", "lock");
    expect(code(() => vote(u.id, "d101", "o1"))).toBe("locked");
    expect(code(() => addComment(u.id, { discussionId: "d101", body: "Hello there" }))).toBe("locked");
  });
});

describe("comments (F05, F06)", () => {
  it("creates, replies, reacts, reports and moderates", () => {
    const u = signIn("fan@example.com", "Pat");
    const other = signIn("other@example.com", "Lee");
    const ed = signIn("ed@essentiallysports.com", "Editor");
    const c = addComment(u.id, { discussionId: "d101", body: "Their defense is better lately." });
    const reply = addComment(other.id, { discussionId: "d101", body: "Disagree, small sample.", parentId: c.id });
    expect(reply.parentId).toBe(c.id);
    expect(toggleReaction(other.id, c.id, "good_point").reactions.good_point).toBe(1);
    report(other.id, c.id, "Off topic");
    expect(moderationQueue(ed.id)).toHaveLength(1);
    moderateComment(ed.id, c.id, "hide_comment");
    const seenByOther = listComments("d101", other.id).find((x) => x.id === c.id)!;
    expect(seenByOther.body).toMatch(/hidden/);
    expect(moderationQueue(ed.id)).toHaveLength(0);
  });

  it("never exposes author emails", () => {
    const u = signIn("private@example.com", "Pat");
    addComment(u.id, { discussionId: "d101", body: "Testing privacy" });
    expect(JSON.stringify(listComments("d101", null))).not.toContain("private@example.com");
  });

  it("only editors moderate; fans cannot", () => {
    const u = signIn("fan@example.com", "Pat");
    const c = addComment(u.id, { discussionId: "d101", body: "A fine comment" });
    expect(code(() => moderateComment(u.id, c.id, "remove_comment"))).toBe("forbidden");
    expect(code(() => moderateDiscussion(u.id, "d101", "lock"))).toBe("forbidden");
  });

  it("holds suspicious posts for review instead of publishing", () => {
    const u = signIn("fan@example.com", "Pat");
    const c = addComment(u.id, { discussionId: "d101", body: "buy now http://a.com http://b.com" });
    expect(c.status).toBe("held");
    expect(listComments("d101", null).some((x) => x.id === c.id)).toBe(false);
    expect(listComments("d101", u.id).some((x) => x.id === c.id)).toBe(true);
  });

  it("rate limits fast posting", () => {
    const u = signIn("fan@example.com", "Pat");
    for (let i = 0; i < 5; i++) addComment(u.id, { discussionId: "d101", body: `Comment number ${i}` });
    expect(code(() => addComment(u.id, { discussionId: "d101", body: "One too many" }))).toBe("rate_limited");
  });

  it("evidence can be attached once, by the author only", () => {
    const u = signIn("fan@example.com", "Pat");
    const other = signIn("other@example.com", "Lee");
    const c = addComment(u.id, { discussionId: "d101", body: "Look at this" });
    const snap = createEvidenceSnapshot(demoProvider, { kind: "team", metricCode: "pts_pg", period: "season", season: 2026, entityIds: ["hcm", "rvh"] });
    expect(code(() => attachEvidence(other.id, c.id, snap))).toBe("forbidden");
    attachEvidence(u.id, c.id, snap);
    expect(code(() => attachEvidence(u.id, c.id, snap))).toBe("invalid");
  });

  it("idempotency keys stop double posts", () => {
    const u = signIn("fan@example.com", "Pat");
    const a = idempotent("k1", () => addComment(u.id, { discussionId: "d101", body: "Only once please" }));
    const b = idempotent("k1", () => addComment(u.id, { discussionId: "d101", body: "Only once please" }));
    expect(a.id).toBe(b.id);
    expect(listComments("d101", u.id)).toHaveLength(1);
  });
});

describe("editorial workflow (F08)", () => {
  it("drafts stay hidden until approved; one featured per matchup", () => {
    const ed = signIn("ed@essentiallysports.com", "Editor");
    const d = createDiscussion(ed.id, { gameId: "2026-w12-hcm-rvh", question: "Who wins the turnover battle?", context: "", options: ["Mariners", "Hawks"] });
    expect(listDiscussions().some((x) => x.id === d.id)).toBe(false);
    moderateDiscussion(ed.id, d.id, "approve_discussion");
    moderateDiscussion(ed.id, d.id, "feature");
    const featured = listDiscussions({ gameId: "2026-w12-hcm-rvh" }).filter((x) => x.featured);
    expect(featured.map((x) => x.id)).toEqual([d.id]);
  });

  it("requires at least two viewpoints and blocks duplicates", () => {
    const ed = signIn("ed@essentiallysports.com", "Editor");
    expect(code(() => createDiscussion(ed.id, { gameId: "2026-w12-hcm-rvh", question: "Is this one-sided?", context: "", options: ["Yes"] }))).toBe("invalid");
    expect(code(() => createDiscussion(ed.id, { gameId: "2026-w12-hcm-rvh", question: "Which offense would you trust in a close game?", context: "", options: ["A", "B"] }))).toBe("invalid");
  });
});

import { getProvider } from "@/lib/data/provider";
import { evidenceState, type EvidenceSnapshot } from "@/lib/stats/evidence";
import type {
  AuditEntry, Comment, CommentView, Discussion, DiscussionStatus, ModerationActionType, PollResults,
  ReactionType, Report, Role, User,
} from "./types";
import { seedDiscussions } from "./seed";

/**
 * In-memory store for the prototype. The PRD targets PostgreSQL + Redis;
 * every function here maps to one table or query so the swap is mechanical.
 * Kept on globalThis so dev hot reloads do not wipe it.
 */
interface DB {
  users: Map<string, User>;
  discussions: Map<string, Discussion>;
  votes: Map<string, { pollId: string; userId: string; optionId: string; at: string }>; // key pollId:userId (unique)
  comments: Map<string, Comment>;
  reactions: Set<string>; // commentId:userId:type
  reports: Map<string, Report>;
  follows: Set<string>; // userId:discussionId
  audit: AuditEntry[];
  idempotency: Map<string, unknown>;
  rate: Map<string, number[]>;
  newsletter: Set<string>;
  seq: number;
}

const g = globalThis as unknown as { __fanpulseDB?: DB };

export function db(): DB {
  if (!g.__fanpulseDB) g.__fanpulseDB = freshDB();
  return g.__fanpulseDB;
}

export function freshDB(): DB {
  const d: DB = {
    users: new Map(), discussions: new Map(), votes: new Map(), comments: new Map(), reactions: new Set(),
    reports: new Map(), follows: new Set(), audit: [], idempotency: new Map(), rate: new Map(),
    newsletter: new Set(), seq: 1000,
  };
  const staff: User = { id: "u_es_editorial", email: "editorial@essentiallysports.com", displayName: "ES Editorial", role: "editor", createdAt: new Date().toISOString(), suspended: false };
  d.users.set(staff.id, staff);
  for (const disc of seedDiscussions(staff.id)) d.discussions.set(disc.id, disc);
  return d;
}

/** Test helper. */
export function resetDB() {
  g.__fanpulseDB = freshDB();
}

function nextId(prefix: string) {
  const d = db();
  d.seq += 1;
  return `${prefix}${d.seq.toString(36)}`;
}

function audit(actorId: string, action: AuditEntry["action"], targetId: string, note?: string) {
  db().audit.unshift({ id: nextId("al_"), actorId, action, targetId, note, at: new Date().toISOString() });
}

export class FanPulseError extends Error {
  constructor(public code: "unauthorized" | "forbidden" | "not_found" | "invalid" | "rate_limited" | "locked", message: string) {
    super(message);
  }
}

export const HTTP_STATUS: Record<FanPulseError["code"], number> = {
  unauthorized: 401, forbidden: 403, not_found: 404, invalid: 400, rate_limited: 429, locked: 409,
};

/** Run a write once per idempotency key (PRD §10). */
export function idempotent<T>(key: string | null | undefined, fn: () => T): T {
  if (!key) return fn();
  const d = db();
  if (d.idempotency.has(key)) return d.idempotency.get(key) as T;
  const out = fn();
  d.idempotency.set(key, out);
  return out;
}

/* ───────────── Users ───────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function signIn(emailRaw: string, displayNameRaw: string): User {
  const email = emailRaw.trim().toLowerCase();
  const displayName = displayNameRaw.trim().replace(/\s+/g, " ");
  if (!EMAIL_RE.test(email)) throw new FanPulseError("invalid", "Enter a valid email address, like name@example.com.");
  if (displayName.length < 2 || displayName.length > 30) throw new FanPulseError("invalid", "Display name must be 2 to 30 characters.");
  const d = db();
  for (const u of d.users.values()) if (u.email === email) return u;
  // Demo rule: ES staff emails get editor tools. A real build uses ES identity roles.
  const role: Role = email.endsWith("@essentiallysports.com") ? "editor" : "fan";
  const user: User = { id: nextId("u_"), email, displayName, role, createdAt: new Date().toISOString(), suspended: false };
  d.users.set(user.id, user);
  return user;
}

export function getUser(id: string | undefined | null): User | null {
  if (!id) return null;
  return db().users.get(id) ?? null;
}

function requireUser(userId: string | null | undefined): User {
  const u = getUser(userId);
  if (!u) throw new FanPulseError("unauthorized", "Sign in to take part.");
  if (u.suspended) throw new FanPulseError("forbidden", "Your account is suspended. You can still read FanPulse.");
  return u;
}

function requireEditor(userId: string | null | undefined): User {
  const u = requireUser(userId);
  if (u.role !== "editor") throw new FanPulseError("forbidden", "Editors only.");
  return u;
}

/* ───────────── Discussions ───────────── */

export function listDiscussions(opts: { gameId?: string; statuses?: DiscussionStatus[] } = {}): Discussion[] {
  const statuses = opts.statuses ?? ["published", "locked"];
  return [...db().discussions.values()]
    .filter((d) => statuses.includes(d.status) && (!opts.gameId || d.gameId === opts.gameId))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt));
}

export function getDiscussion(id: string): Discussion | null {
  return db().discussions.get(id) ?? null;
}

export function createDiscussion(
  actorId: string,
  input: { gameId: string; question: string; context: string; options: string[]; statCodes?: string[]; period?: "season" | "last5"; source?: "editor" | "signal" },
): Discussion {
  const actor = requireEditor(actorId);
  const question = input.question.trim();
  const opts = input.options.map((o) => o.trim()).filter(Boolean);
  if (!getProvider().game(input.gameId)) throw new FanPulseError("invalid", "Pick a matchup.");
  if (question.length < 10 || question.length > 160) throw new FanPulseError("invalid", "Question must be 10 to 160 characters.");
  if (opts.length < 2 || opts.length > 4) throw new FanPulseError("invalid", "Give 2 to 4 answer choices so more than one view is possible.");
  const dupe = [...db().discussions.values()].find((d) => d.gameId === input.gameId && d.question.toLowerCase() === question.toLowerCase());
  if (dupe) throw new FanPulseError("invalid", "That question already exists for this matchup.");
  const id = nextId("d");
  const now = new Date().toISOString();
  const disc: Discussion = {
    id, slug: slugify(question), gameId: input.gameId, question, context: input.context.trim(),
    statCodes: input.statCodes ?? [], period: input.period ?? "season",
    status: "pending", featured: false, source: input.source ?? "editor", createdBy: actor.id, createdAt: now, updatedAt: now,
    poll: { id: `poll_${id}`, discussionId: id, options: opts.map((label, i) => ({ id: `o${i + 1}`, label })) },
  };
  db().discussions.set(id, disc);
  audit(actor.id, "create_discussion", id);
  return disc;
}

export function moderateDiscussion(actorId: string, discussionId: string, action: "approve_discussion" | "feature" | "unfeature" | "lock" | "unlock" | "archive"): Discussion {
  const actor = requireEditor(actorId);
  const d = getDiscussion(discussionId);
  if (!d) throw new FanPulseError("not_found", "Discussion not found.");
  switch (action) {
    case "approve_discussion": d.status = "published"; break;
    case "feature":
      if (d.status !== "published") throw new FanPulseError("invalid", "Only published discussions can be featured.");
      for (const other of db().discussions.values()) if (other.gameId === d.gameId) other.featured = false;
      d.featured = true; break;
    case "unfeature": d.featured = false; break;
    case "lock": d.status = "locked"; break;
    case "unlock": d.status = "published"; break;
    case "archive": d.status = "archived"; d.featured = false; break;
  }
  d.updatedAt = new Date().toISOString();
  audit(actor.id, action, d.id);
  return d;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/* ───────────── Polls ───────────── */

export function vote(userId: string | null, discussionId: string, optionId: string): PollResults {
  const user = requireUser(userId);
  const d = getDiscussion(discussionId);
  if (!d || d.status === "pending" || d.status === "archived") throw new FanPulseError("not_found", "Poll not found.");
  if (d.status === "locked") throw new FanPulseError("locked", "Voting is closed on this discussion.");
  if (!d.poll.options.some((o) => o.id === optionId)) throw new FanPulseError("invalid", "Pick one of the choices.");
  const key = `${d.poll.id}:${user.id}`;
  const votes = db().votes;
  // One counted vote per account per poll (F04). Re-voting changes the choice, never the count.
  const existing = votes.get(key);
  votes.set(key, { pollId: d.poll.id, userId: user.id, optionId, at: existing?.at ?? new Date().toISOString() });
  if (!existing) audit(user.id, "vote", d.poll.id);
  return pollResults(discussionId, user.id);
}

export function pollResults(discussionId: string, viewerId?: string | null): PollResults {
  const d = getDiscussion(discussionId);
  if (!d) throw new FanPulseError("not_found", "Poll not found.");
  const counts = new Map<string, number>(d.poll.options.map((o) => [o.id, 0]));
  let myVote: string | null = null;
  for (const v of db().votes.values()) {
    if (v.pollId !== d.poll.id) continue;
    if (db().users.get(v.userId)?.suspended) continue;
    counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1);
    if (viewerId && v.userId === viewerId) myVote = v.optionId;
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  // Largest-remainder rounding so percentages always sum to 100.
  const raw = d.poll.options.map((o) => ({ ...o, votes: counts.get(o.id) ?? 0, exact: total ? ((counts.get(o.id) ?? 0) / total) * 100 : 0 }));
  const floors = raw.map((r) => Math.floor(r.exact));
  let left = total ? 100 - floors.reduce((a, b) => a + b, 0) : 0;
  const order = raw.map((r, i) => ({ i, rem: r.exact - floors[i] })).sort((a, b) => b.rem - a.rem);
  for (const o of order) { if (left <= 0) break; floors[o.i] += 1; left -= 1; }
  return { pollId: d.poll.id, total, options: raw.map((r, i) => ({ id: r.id, label: r.label, votes: r.votes, pct: floors[i] })), myVote };
}

/* ───────────── Comments ───────────── */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function rateLimit(key: string) {
  const now = Date.now();
  const d = db();
  const hits = (d.rate.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) throw new FanPulseError("rate_limited", "You're posting quickly. Wait a minute, then try again.");
  hits.push(now);
  d.rate.set(key, hits);
}

/** Lightweight automated screen. Suspicious posts are held for review, not silently dropped. */
export function screen(body: string): "visible" | "held" {
  const links = (body.match(/https?:\/\//gi) ?? []).length;
  if (links > 1) return "held";
  if (/(.)\1{9,}/.test(body)) return "held";
  if (body.length > 40 && body === body.toUpperCase() && /[A-Z]/.test(body)) return "held";
  return "visible";
}

export function addComment(
  userId: string | null,
  input: { discussionId: string; body: string; parentId?: string | null; evidence?: EvidenceSnapshot },
): Comment {
  const user = requireUser(userId);
  const d = getDiscussion(input.discussionId);
  if (!d || d.status === "pending" || d.status === "archived") throw new FanPulseError("not_found", "Discussion not found.");
  if (d.status === "locked") throw new FanPulseError("locked", "This discussion is closed to new comments.");
  const body = input.body.trim();
  if (body.length < 2) throw new FanPulseError("invalid", "Write a comment before posting.");
  if (body.length > 2000) throw new FanPulseError("invalid", "Comments can be up to 2,000 characters.");
  if (input.parentId) {
    const parent = db().comments.get(input.parentId);
    if (!parent || parent.discussionId !== d.id) throw new FanPulseError("invalid", "The comment you're replying to no longer exists.");
  }
  rateLimit(`comment:${user.id}`);
  const c: Comment = {
    id: nextId("c"), discussionId: d.id, parentId: input.parentId ?? null, authorId: user.id, body,
    evidence: input.evidence, status: screen(body), createdAt: new Date().toISOString(),
  };
  db().comments.set(c.id, c);
  audit(user.id, "comment", c.id, c.status === "held" ? "auto-held" : undefined);
  return c;
}

/** Attach evidence to your own comment after posting (POST /comments/:id/evidence). */
export function attachEvidence(userId: string | null, commentId: string, evidence: EvidenceSnapshot): Comment {
  const user = requireUser(userId);
  const c = db().comments.get(commentId);
  if (!c) throw new FanPulseError("not_found", "Comment not found.");
  if (c.authorId !== user.id) throw new FanPulseError("forbidden", "You can only add evidence to your own comments.");
  if (c.evidence) throw new FanPulseError("invalid", "This comment already has evidence. Evidence can't be changed once posted.");
  c.evidence = evidence;
  return c;
}

export function toggleReaction(userId: string | null, commentId: string, type: ReactionType): CommentView {
  const user = requireUser(userId);
  const c = db().comments.get(commentId);
  if (!c || c.status !== "visible") throw new FanPulseError("not_found", "Comment not found.");
  if (type !== "agree" && type !== "good_point") throw new FanPulseError("invalid", "Unknown reaction.");
  const key = `${c.id}:${user.id}:${type}`;
  const r = db().reactions;
  if (r.has(key)) r.delete(key); else r.add(key);
  return toView(c, user.id);
}

function toView(c: Comment, viewerId?: string | null): CommentView {
  const author = db().users.get(c.authorId);
  const reactions: Record<ReactionType, number> = { agree: 0, good_point: 0 };
  const mine: ReactionType[] = [];
  for (const key of db().reactions) {
    const [cid, uid, type] = key.split(":") as [string, string, ReactionType];
    if (cid !== c.id) continue;
    reactions[type] += 1;
    if (uid === viewerId) mine.push(type);
  }
  const hiddenBody = c.status === "removed" ? "This comment was removed by a moderator." : c.status === "hidden" ? "This comment is hidden while a moderator reviews it." : c.body;
  return {
    id: c.id, parentId: c.parentId, authorName: author?.displayName ?? "Former member", authorIsStaff: author?.role === "editor",
    body: c.status === "visible" || c.authorId === viewerId ? c.body : hiddenBody,
    evidence: c.evidence && (c.status === "visible" || c.authorId === viewerId) ? { ...c.evidence, state: evidenceState(getProvider(), c.evidence) } : undefined,
    status: c.status, createdAt: c.createdAt, reactions, myReactions: mine, isMine: c.authorId === viewerId,
  };
}

export function listComments(discussionId: string, viewerId?: string | null, sort: "newest" | "oldest" | "top" = "newest"): CommentView[] {
  const all = [...db().comments.values()].filter((c) => c.discussionId === discussionId);
  // Held comments are visible only to their author until reviewed.
  const shown = all.filter((c) => c.status !== "held" || c.authorId === viewerId);
  const views = shown.map((c) => toView(c, viewerId));
  const score = (v: CommentView) => v.reactions.agree + v.reactions.good_point * 2 + (v.evidence ? 1 : 0);
  views.sort((a, b) => {
    if (sort === "top") return score(b) - score(a) || b.createdAt.localeCompare(a.createdAt);
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    return b.createdAt.localeCompare(a.createdAt);
  });
  return views;
}

export function commentCount(discussionId: string): number {
  let n = 0;
  for (const c of db().comments.values()) if (c.discussionId === discussionId && c.status === "visible") n++;
  return n;
}

/* ───────────── Reports and moderation ───────────── */

export function report(userId: string | null, commentId: string, reason: string): Report {
  const user = requireUser(userId);
  const c = db().comments.get(commentId);
  if (!c) throw new FanPulseError("not_found", "Comment not found.");
  const clean = reason.trim();
  if (!["Spam", "Abuse or harassment", "False information", "Off topic", "Other"].includes(clean)) throw new FanPulseError("invalid", "Pick a reason.");
  const existing = [...db().reports.values()].find((r) => r.commentId === c.id && r.reporterId === user.id && r.status === "open");
  if (existing) return existing;
  const r: Report = { id: nextId("r"), commentId: c.id, reporterId: user.id, reason: clean, createdAt: new Date().toISOString(), status: "open" };
  db().reports.set(r.id, r);
  audit(user.id, "report", c.id, clean);
  return r;
}

export interface QueueItem {
  comment: Comment;
  authorName: string;
  discussionQuestion: string;
  reports: Report[];
  severity: "high" | "medium" | "low";
}

export function moderationQueue(actorId: string): QueueItem[] {
  requireEditor(actorId);
  const d = db();
  const items: QueueItem[] = [];
  for (const c of d.comments.values()) {
    const reps = [...d.reports.values()].filter((r) => r.commentId === c.id && r.status === "open");
    if (reps.length === 0 && c.status !== "held") continue;
    const abusive = reps.some((r) => r.reason === "Abuse or harassment");
    const severity = abusive || reps.length >= 3 ? "high" : reps.length >= 1 ? "medium" : "low";
    items.push({ comment: c, authorName: d.users.get(c.authorId)?.displayName ?? "?", discussionQuestion: d.discussions.get(c.discussionId)?.question ?? "?", reports: reps, severity });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity] || a.comment.createdAt.localeCompare(b.comment.createdAt));
}

export function moderateComment(actorId: string, commentId: string, action: "hide_comment" | "remove_comment" | "restore_comment" | "suspend_user"): Comment {
  const actor = requireEditor(actorId);
  const d = db();
  const c = d.comments.get(commentId);
  if (!c) throw new FanPulseError("not_found", "Comment not found.");
  if (action === "hide_comment") c.status = "hidden";
  if (action === "remove_comment") c.status = "removed";
  if (action === "restore_comment") c.status = "visible";
  if (action === "suspend_user") {
    const u = d.users.get(c.authorId);
    if (u && u.role !== "editor") u.suspended = true;
    c.status = "removed";
  }
  for (const r of d.reports.values()) if (r.commentId === c.id) r.status = "resolved";
  audit(actor.id, action, action === "suspend_user" ? c.authorId : c.id);
  return c;
}

export function auditLog(actorId: string, limit = 50): (AuditEntry & { actorName: string })[] {
  requireEditor(actorId);
  return db().audit.slice(0, limit).map((a) => ({ ...a, actorName: db().users.get(a.actorId)?.displayName ?? a.actorId }));
}

/* ───────────── Follows and newsletter ───────────── */

export function toggleFollow(userId: string | null, discussionId: string): boolean {
  const user = requireUser(userId);
  if (!getDiscussion(discussionId)) throw new FanPulseError("not_found", "Discussion not found.");
  const key = `${user.id}:${discussionId}`;
  const f = db().follows;
  if (f.has(key)) { f.delete(key); return false; }
  f.add(key);
  return true;
}

export function isFollowing(userId: string | null | undefined, discussionId: string): boolean {
  return !!userId && db().follows.has(`${userId}:${discussionId}`);
}

/** Newsletter opt-in is separate from account creation (PRD §11). */
export function newsletterSignup(emailRaw: string): void {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new FanPulseError("invalid", "Enter a valid email address, like name@example.com.");
  db().newsletter.add(email);
}

/* ───────────── Discovery ranking (PRD §8) ───────────── */

export function participationStats(discussionId: string, sinceMs = 72 * 3600_000) {
  const d = db();
  const since = Date.now() - sinceMs;
  const disc = d.discussions.get(discussionId);
  let recentComments = 0, evidenceComments = 0;
  const authors = new Set<string>();
  for (const c of d.comments.values()) {
    if (c.discussionId !== discussionId || c.status !== "visible") continue;
    if (Date.parse(c.createdAt) >= since) recentComments++;
    if (c.evidence) evidenceComments++;
    authors.add(c.authorId);
  }
  let votes = 0;
  if (disc) for (const v of d.votes.values()) if (v.pollId === disc.poll.id) votes++;
  return { recentComments, evidenceComments, distinctAuthors: authors.size, votes };
}

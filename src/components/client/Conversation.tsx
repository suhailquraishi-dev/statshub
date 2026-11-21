"use client";

import { useRef, useState } from "react";
import type { CommentView, ReactionType } from "@/lib/store/types";
import type { EvidenceRequest, EvidenceSnapshot } from "@/lib/stats/evidence";
import { api, ApiError, newKey } from "@/lib/client-api";
import { track } from "@/lib/analytics";
import { useAuth } from "./AuthProvider";
import { EvidenceBuilder, EvidenceCard, type EvidenceOptions } from "./Evidence";
import { NewsletterCard } from "./Newsletter";

type Sort = "newest" | "oldest" | "top";
const REASONS = ["Spam", "Abuse or harassment", "False information", "Off topic", "Other"];
const TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Composer({
  discussionId, gameId, parentId, evidenceOpts, onPosted, onCancel, autoFocus,
}: {
  discussionId: string; gameId: string; parentId?: string; evidenceOpts: EvidenceOptions;
  onPosted: (c: CommentView) => void; onCancel?: () => void; autoFocus?: boolean;
}) {
  const { user, requireAuth } = useAuth();
  const [text, setText] = useState("");
  const [building, setBuilding] = useState(false);
  const [evidence, setEvidence] = useState<{ req: EvidenceRequest; snap: EvidenceSnapshot } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const id = `cmp-${parentId ?? "root"}`;

  if (!user) {
    return (
      <div className="fp-callout fp-btn-row" style={{ justifyContent: "space-between" }}>
        <span>{parentId ? "Sign in to reply." : "Have a take? Sign in to join the conversation."}</span>
        <button className="fp-btn" type="button" onClick={() => requireAuth("Sign in to comment.")}>Sign in to comment</button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) { setError("Write a comment before posting."); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { comment } = await api<{ comment: CommentView }>(`/api/v1/discussions/${discussionId}/comments`, {
        body: { body: text, parentId, evidence: evidence?.req }, idempotencyKey: key.current,
      });
      key.current = newKey();
      setText("");
      setEvidence(null);
      track(parentId ? "reply_published" : "comment_published", { matchup: gameId, discussion: discussionId, has_evidence: !!comment.evidence, auth: "signed_in" });
      if (comment.evidence) track("stat_attached", { matchup: gameId, discussion: discussionId, metric: comment.evidence.metricCode });
      if (comment.status === "held") setNotice("Thanks. Your comment is waiting for a quick review before others can see it.");
      onPosted(comment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Your comment didn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="fp-stack-sm" noValidate>
      <div className="fp-field">
        <label htmlFor={id} className={parentId ? "sr-only" : "fp-label"}>{parentId ? "Your reply" : `Your take, ${user.displayName}`}</label>
        <textarea
          id={id} className="fp-textarea" value={text} maxLength={2000} autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setError(""); }}
          placeholder={parentId ? "Reply with your reasoning" : "Their pass rush has been better lately, and here's why…"}
          aria-invalid={!!error || undefined} aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
        />
        <span id={`${id}-hint`} className="fp-hint">{2000 - text.length} characters left. Keep it civil; disagreements are welcome.</span>
      </div>
      {evidence && (
        <div className="fp-stack-sm">
          <EvidenceCard snap={evidence.snap} preview />
          <div><button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" onClick={() => setEvidence(null)}>Remove stat</button></div>
        </div>
      )}
      {building && !evidence && (
        <EvidenceBuilder opts={evidenceOpts} onAttach={(req, snap) => { setEvidence({ req, snap }); setBuilding(false); }} onCancel={() => setBuilding(false)} />
      )}
      {error && <p id={`${id}-err`} className="fp-error" role="alert">{error}</p>}
      {notice && <p className="fp-alert fp-alert--warn" role="status">{notice}</p>}
      <div className="fp-btn-row">
        <button type="submit" className="fp-btn" disabled={busy}>{busy ? "Posting…" : parentId ? "Post reply" : "Post comment"}</button>
        {!evidence && !building && (
          <button type="button" className="fp-btn" onClick={() => setBuilding(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16V9M12 16V5M17 16v-4"/></svg>
            Add a stat
          </button>
        )}
        {onCancel && <button type="button" className="fp-btn fp-btn--ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function CommentItem({
  c, replies, discussionId, gameId, locked, evidenceOpts, onChange, onPosted,
}: {
  c: CommentView; replies: CommentView[]; discussionId: string; gameId: string; locked: boolean; evidenceOpts: EvidenceOptions;
  onChange: (c: CommentView) => void; onPosted: (c: CommentView) => void;
}) {
  const { requireAuth } = useAuth();
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [msg, setMsg] = useState("");
  const muted = c.status !== "visible";

  function react(type: ReactionType) {
    requireAuth("Sign in to react to comments.", async () => {
      try {
        const { comment } = await api<{ comment: CommentView }>(`/api/v1/comments/${c.id}/reactions`, { body: { type } });
        onChange(comment);
      } catch (err) {
        setMsg(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      }
    });
  }

  async function sendReport(reason: string) {
    try {
      await api("/api/v1/reports", { body: { commentId: c.id, reason } });
      setReported(true);
      setReporting(false);
      track("report_submitted", { matchup: gameId, discussion: discussionId, reason });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Report failed. Try again.");
    }
  }

  return (
    <li className={`fp-comment${muted ? " fp-comment--muted" : ""}`}>
      <div className="fp-comment__head">
        <span className="fp-comment__author">{c.authorName}</span>
        {c.authorIsStaff && <span className="fp-badge fp-badge--brand">ES staff</span>}
        {c.isMine && c.status === "held" && <span className="fp-badge fp-badge--warn">Waiting for review</span>}
        <span className="fp-meta"><time dateTime={c.createdAt}>{TIME.format(new Date(c.createdAt))}</time></span>
      </div>
      <p className="fp-comment__body">{c.body}</p>
      {c.evidence && <EvidenceCard snap={c.evidence} state={c.evidence.state} />}
      {c.status === "visible" && (
        <div className="fp-comment__actions">
          <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost fp-react" aria-pressed={c.myReactions.includes("agree")} onClick={() => react("agree")}>
            Agree{c.reactions.agree ? ` · ${c.reactions.agree}` : ""}
          </button>
          <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost fp-react" aria-pressed={c.myReactions.includes("good_point")} onClick={() => react("good_point")}>
            Good point{c.reactions.good_point ? ` · ${c.reactions.good_point}` : ""}
          </button>
          {!locked && !c.parentId && (
            <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" aria-expanded={replying} onClick={() => requireAuth("Sign in to reply.", () => setReplying((r) => !r))}>Reply</button>
          )}
          {!c.isMine && !reported && (
            <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" aria-expanded={reporting} onClick={() => requireAuth("Sign in to report a comment.", () => setReporting((r) => !r))}>Report</button>
          )}
          {reported && <span className="fp-meta" role="status" style={{ alignSelf: "center", paddingLeft: 12 }}>Reported. A moderator will review it.</span>}
        </div>
      )}
      {reporting && (
        <div className="fp-callout fp-stack-sm" role="group" aria-label="Why are you reporting this comment?">
          <p style={{ fontWeight: 600 }}>Why are you reporting this?</p>
          <div className="fp-btn-row">
            {REASONS.map((r) => <button key={r} type="button" className="fp-btn fp-btn--sm" onClick={() => sendReport(r)}>{r}</button>)}
            <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" onClick={() => setReporting(false)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className="fp-error" role="alert">{msg}</p>}
      {replying && (
        <Composer discussionId={discussionId} gameId={gameId} parentId={c.id} evidenceOpts={evidenceOpts} autoFocus
          onPosted={(r) => { onPosted(r); setReplying(false); }} onCancel={() => setReplying(false)} />
      )}
      {replies.length > 0 && (
        <ul className="fp-comments fp-comments--replies" aria-label={`Replies to ${c.authorName}`}>
          {replies.map((r) => (
            <CommentItem key={r.id} c={r} replies={[]} discussionId={discussionId} gameId={gameId} locked={locked} evidenceOpts={evidenceOpts} onChange={onChange} onPosted={onPosted} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Conversation({
  discussionId, gameId, initial, locked, evidenceOpts,
}: { discussionId: string; gameId: string; initial: CommentView[]; locked: boolean; evidenceOpts: EvidenceOptions }) {
  const [comments, setComments] = useState(initial);
  const [sort, setSort] = useState<Sort>("newest");
  const [loadError, setLoadError] = useState("");
  const [posted, setPosted] = useState(false);

  async function changeSort(s: Sort) {
    setSort(s);
    try {
      const d = await api<{ comments: CommentView[] }>(`/api/v1/discussions/${discussionId}?sort=${s}`);
      setComments(d.comments);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load comments.");
    }
  }

  const upsert = (c: CommentView) => setComments((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [c, ...list]));
  const top = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const visibleCount = comments.filter((c) => c.status === "visible").length;

  return (
    <div className="fp-stack-sm">
      <div className="fp-section-head" style={{ marginBottom: 0 }}>
        <h2 className="fp-section-title" id="conversation">Conversation <span className="fp-meta" style={{ fontFamily: "var(--es-font-ui)", fontWeight: 400, textTransform: "none" }}>({visibleCount})</span></h2>
        <div className="fp-field" style={{ gridAutoFlow: "column", alignItems: "center" }}>
          <label htmlFor={`sort-${discussionId}`} className="fp-label">Sort</label>
          <select id={`sort-${discussionId}`} className="fp-select" value={sort} onChange={(e) => changeSort(e.target.value as Sort)} style={{ width: "auto" }}>
            <option value="newest">Newest first</option>
            <option value="top">Most helpful</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      {locked ? (
        <p className="fp-alert fp-alert--warn" role="status">An editor has closed this discussion to new comments. You can still read it.</p>
      ) : (
        <Composer discussionId={discussionId} gameId={gameId} evidenceOpts={evidenceOpts} onPosted={(c) => { upsert(c); setPosted(true); }} />
      )}
      {posted && <NewsletterCard context="comment" />}
      {loadError && <p className="fp-alert fp-alert--bad" role="alert">{loadError}</p>}
      {top.length === 0 ? (
        <div className="fp-empty">
          <p className="fp-empty__title">No comments yet</p>
          <p>Start the conversation. Adding a stat helps others see where you&apos;re coming from.</p>
        </div>
      ) : (
        <ul className="fp-comments">
          {top.map((c) => (
            <CommentItem key={c.id} c={c} replies={repliesOf(c.id)} discussionId={discussionId} gameId={gameId} locked={locked} evidenceOpts={evidenceOpts} onChange={upsert} onPosted={upsert} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function FollowButton({ discussionId, initial }: { discussionId: string; initial: boolean }) {
  const { requireAuth } = useAuth();
  const [following, setFollowing] = useState(initial);
  const [msg, setMsg] = useState("");
  function toggle() {
    requireAuth("Sign in to follow this discussion.", async () => {
      try {
        const r = await api<{ following: boolean }>("/api/v1/follows", { body: { discussionId } });
        setFollowing(r.following);
        setMsg(r.following ? "Following. You'll see new replies here when you come back." : "Unfollowed.");
        if (r.following) track("discussion_followed", { discussion: discussionId });
      } catch (err) {
        setMsg(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      }
    });
  }
  return (
    <span className="fp-btn-row">
      <button type="button" className="fp-btn fp-btn--sm" aria-pressed={following} onClick={toggle}>{following ? "Following" : "Follow discussion"}</button>
      <span className="fp-meta" role="status">{msg}</span>
    </span>
  );
}

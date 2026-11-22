"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client-api";
import { Chevron } from "@/components/Chevron";
import type { Signal } from "@/lib/stats/signals";
import type { CommentStatus, DiscussionStatus } from "@/lib/store/types";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(url: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(url, { body });
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function DiscussionActions({ id, status, featured }: { id: string; status: DiscussionStatus; featured: boolean }) {
  const { busy, error, run } = useAction();
  const act = (action: string) => run(`/api/v1/editor/discussions/${id}`, { action });
  const [verdict, setVerdict] = useState("");
  return (
    <div className="fp-stack-sm">
      <div className="fp-btn-row">
        {status === "pending" && <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("approve_discussion")}>Approve and publish</button>}
        {status === "published" && !featured && <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("feature")}>Feature</button>}
        {featured && <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("unfeature")}>Unfeature</button>}
        {status === "published" && <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("lock")}>Close</button>}
        {status === "locked" && <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("unlock")}>Reopen</button>}
        <button className="fp-btn fp-btn--sm fp-btn--danger" disabled={busy} onClick={() => act("archive")}>{status === "pending" ? "Reject" : "Archive"}</button>
      </div>
      {(status === "published" || status === "locked") && (
        <details className="fp-details">
          <summary>Postgame verdict <Chevron direction="down" /></summary>
          <form className="fp-stack-sm" onSubmit={async (e) => { e.preventDefault(); if (await run(`/api/v1/editor/discussions/${id}`, { action: "verdict", text: verdict })) setVerdict(""); }}>
            <div className="fp-field">
              <label className="fp-label" htmlFor={`verdict-${id}`}>How did the question play out? (20 to 600 characters)</label>
              <textarea id={`verdict-${id}`} className="fp-textarea" value={verdict} maxLength={600} onChange={(e) => setVerdict(e.target.value)} />
            </div>
            <div><button type="submit" className="fp-btn fp-btn--sm" disabled={busy}>Publish verdict</button></div>
          </form>
        </details>
      )}
      {error && <p className="fp-error" role="alert">{error}</p>}
    </div>
  );
}

export function CommentActions({ commentId, status }: { commentId: string; status: CommentStatus }) {
  const { busy, error, run } = useAction();
  const act = (action: string) => run(`/api/v1/editor/comments/${commentId}`, { action });
  return (
    <div className="fp-stack-sm">
      <div className="fp-btn-row">
        <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("restore_comment")}>{status === "held" ? "Approve" : "Keep"}</button>
        <button className="fp-btn fp-btn--sm" disabled={busy} onClick={() => act("hide_comment")}>Hide</button>
        <button className="fp-btn fp-btn--sm fp-btn--danger" disabled={busy} onClick={() => act("remove_comment")}>Remove</button>
        <button className="fp-btn fp-btn--sm fp-btn--danger" disabled={busy} onClick={() => { if (confirm("Suspend this member? Their comment is removed and they can no longer post.")) act("suspend_user"); }}>Suspend member</button>
      </div>
      {error && <p className="fp-error" role="alert">{error}</p>}
    </div>
  );
}

export function SignalDraft({ signal, matchupLabel }: { signal: Signal; matchupLabel: string }) {
  const { busy, error, run } = useAction();
  const [done, setDone] = useState(false);
  return (
    <div className="fp-stack-sm">
      <p>{signal.summary}</p>
      <p className="fp-meta">{matchupLabel} · Change {Math.round(signal.relChange * 100)}% · Draft: “{signal.draftQuestion}”</p>
      {done ? <p className="fp-meta" role="status">Draft added to the approval list.</p> : (
        <div>
          <button className="fp-btn fp-btn--sm" disabled={busy} onClick={async () => {
            if (await run("/api/v1/editor/discussions", { gameId: signal.gameId, question: signal.draftQuestion, context: signal.summary, options: signal.draftOptions, statCodes: [signal.metricCode], period: "last5", source: "signal" })) setDone(true);
          }}>Create draft</button>
        </div>
      )}
      {error && <p className="fp-error" role="alert">{error}</p>}
    </div>
  );
}

export function CreateDiscussion({ games }: { games: { id: string; label: string }[] }) {
  const { busy, error, run } = useAction();
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const ok = await run("/api/v1/editor/discussions", {
      gameId: f.get("gameId"), question: f.get("question"), context: f.get("context"),
      options: [f.get("o1"), f.get("o2"), f.get("o3"), f.get("o4")].map((x) => String(x ?? "")),
    });
    if (!ok) return;
    form.reset();
    setSent(true);
  }
  return (
    <form className="fp-stack-sm" onSubmit={submit} onChange={() => setSent(false)}>
      <div className="fp-field">
        <label className="fp-label" htmlFor="nd-game">Matchup</label>
        <select id="nd-game" name="gameId" className="fp-select">{games.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
      </div>
      <div className="fp-field">
        <label className="fp-label" htmlFor="nd-q">Question</label>
        <input id="nd-q" name="question" className="fp-input" maxLength={160} placeholder="Which defense would you rather have in January?" />
        <span className="fp-hint">Neutral wording that allows more than one reasonable answer.</span>
      </div>
      <div className="fp-field">
        <label className="fp-label" htmlFor="nd-c">What the numbers say</label>
        <textarea id="nd-c" name="context" className="fp-textarea" placeholder="Last 5 games: Mariners allow 17.2 points per game, Hawks 22.8." />
        <span className="fp-hint">Use only numbers shown on the matchup page, with the period and sample size.</span>
      </div>
      <fieldset className="fp-poll">
        <legend className="fp-label">Answer choices (2 to 4)</legend>
        {[1, 2, 3, 4].map((n) => <input key={n} name={`o${n}`} className="fp-input" aria-label={`Choice ${n}${n > 2 ? " (optional)" : ""}`} placeholder={n > 2 ? "Optional" : `Choice ${n}`} />)}
      </fieldset>
      {error && <p className="fp-error" role="alert">{error}</p>}
      {sent && !error && <p className="fp-alert fp-alert--good" role="status">Draft saved. Approve it above to publish.</p>}
      <div><button className="fp-btn" type="submit" disabled={busy}>Save as draft</button></div>
    </form>
  );
}

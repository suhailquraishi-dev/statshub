"use client";

import { useId, useState } from "react";
import type { PollResults } from "@/lib/store/types";
import { api, ApiError } from "@/lib/client-api";
import { track } from "@/lib/analytics";
import { useAuth } from "./AuthProvider";
import { NewsletterCard } from "./Newsletter";

export function Results({ poll }: { poll: PollResults }) {
  return (
    <div className="fp-stack-sm" role="group" aria-label="Poll results">
      {poll.options.map((o) => (
        <div key={o.id} className={`fp-result${poll.myVote === o.id ? " fp-result--mine" : ""}`}>
          <div className="fp-result__row">
            <span>{poll.myVote === o.id && <span className="fp-result__check" aria-hidden="true">✓ </span>}{o.label}{poll.myVote === o.id && <span className="fp-badge fp-badge--brand" style={{ marginLeft: 8 }}>Your vote</span>}</span>
            <strong>{o.pct}%</strong>
          </div>
          <div className="fp-result__bar" aria-hidden="true"><span style={{ width: `${o.pct}%` }} /></div>
          <span className="sr-only">{o.votes} votes</span>
        </div>
      ))}
      <p className="fp-meta">{poll.total === 0 ? "No votes yet. Be the first." : `${poll.total.toLocaleString()} vote${poll.total === 1 ? "" : "s"} · one per account`}</p>
    </div>
  );
}

export function Poll({ discussionId, question, initial, locked, gameId }: { discussionId: string; question: string; initial: PollResults; locked?: boolean; gameId: string }) {
  const { requireAuth } = useAuth();
  const [poll, setPoll] = useState(initial);
  const [choice, setChoice] = useState<string | null>(initial.myVote);
  const [showResults, setShowResults] = useState(!!initial.myVote || !!locked);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const name = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) { setError("Pick an answer first."); return; }
    requireAuth("Sign in to vote. One vote per account keeps results fair.", async () => {
      setBusy(true);
      setError("");
      try {
        const { poll: p } = await api<{ poll: PollResults }>(`/api/v1/polls/${initial.pollId}/vote`, { body: { optionId: choice } });
        setPoll(p);
        setShowResults(true);
        setJustVoted(true);
        track("poll_vote_submitted", { matchup: gameId, discussion: discussionId, auth: "signed_in" });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Your vote didn't go through. Try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  if (showResults) {
    return (
      <div className="fp-stack-sm">
        <Results poll={poll} />
        {justVoted && <p className="fp-alert fp-alert--good" role="status">Thanks, your vote is counted.</p>}
        {!locked && (
          <div className="fp-btn-row">
            <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" onClick={() => { setShowResults(false); setJustVoted(false); }}>
              {poll.myVote ? "Change my vote" : "Back to voting"}
            </button>
          </div>
        )}
        {locked && <p className="fp-meta">Voting is closed.</p>}
        {justVoted && <NewsletterCard context="poll" />}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="fp-stack-sm" noValidate>
      <fieldset className="fp-poll" aria-describedby={error ? `${name}-err` : undefined}>
        <legend className="sr-only">{question}</legend>
        {poll.options.map((o) => (
          <label key={o.id} className="fp-poll__opt">
            <input type="radio" name={name} value={o.id} checked={choice === o.id} onChange={() => { setChoice(o.id); setError(""); }} />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      {error && <p id={`${name}-err`} className="fp-error" role="alert">{error}</p>}
      <div className="fp-btn-row">
        <button type="submit" className="fp-btn fp-btn--primary" disabled={busy}>{busy ? "Saving…" : poll.myVote ? "Update vote" : "Vote"}</button>
        <button type="button" className="fp-btn fp-btn--ghost" onClick={() => setShowResults(true)}>See results</button>
      </div>
    </form>
  );
}

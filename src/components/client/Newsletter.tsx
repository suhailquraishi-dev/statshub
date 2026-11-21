"use client";

import { useEffect, useRef, useState } from "react";

/** Offer the newsletter once per visit, not after every action. */
let offeredTo: object | null = null;
import { api, ApiError } from "@/lib/client-api";
import { track } from "@/lib/analytics";

/** Contextual, separate newsletter opt-in shown after engagement (PRD §11, §13). */
export function NewsletterCard({ context }: { context: "poll" | "comment" }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "dismissed">("idle");
  const [error, setError] = useState("");
  const me = useRef({});
  const [mine, setMine] = useState(false);
  useEffect(() => {
    // The first card to mount claims the offer (safe under Strict Mode's double effects).
    if (offeredTo === null) offeredTo = me.current;
    setMine(offeredTo === me.current);
  }, []);
  if (!mine || state === "dismissed") return null;
  if (state === "done") return <p className="fp-alert fp-alert--good" role="status">You&apos;re on the list for the weekly NFL newsletter.</p>;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    setState("busy");
    setError("");
    try {
      await api("/api/v1/newsletter", { body: { email } });
      track("newsletter_signup_completed", { context });
      setState("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setState("idle");
    }
  }
  return (
    <form className="fp-callout fp-stack-sm" onSubmit={submit} noValidate aria-labelledby="nl-title">
      <p id="nl-title" style={{ fontWeight: 600 }}>Get the week&apos;s best NFL debates by email</p>
      <div className="fp-field">
        <label htmlFor={`nl-${context}`} className="fp-label">Email</label>
        <input id={`nl-${context}`} name="email" type="email" autoComplete="email" className="fp-input" placeholder="pat@example.com" aria-invalid={!!error || undefined} />
        {error && <span className="fp-error" role="alert">{error}</span>}
      </div>
      <div className="fp-btn-row">
        <button className="fp-btn" type="submit" disabled={state === "busy"}>Sign me up</button>
        <button className="fp-btn fp-btn--ghost" type="button" onClick={() => setState("dismissed")}>No thanks</button>
      </div>
      <p className="fp-hint">Separate from your FanPulse account. Unsubscribe any time.</p>
    </form>
  );
}

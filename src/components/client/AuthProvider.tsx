"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client-api";

export interface SessionUser { id: string; displayName: string; role: "fan" | "editor" }

interface AuthCtx {
  user: SessionUser | null;
  /** Run `then` now if signed in, otherwise ask the visitor to sign in first. */
  requireAuth: (reason: string, then?: (u: SessionUser) => void) => void;
  signOut: () => Promise<void>;
  openSignIn: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}

export function AuthProvider({ initialUser, children }: { initialUser: SessionUser | null; children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<((u: SessionUser) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => setUser(initialUser), [initialUser]);

  const open = useCallback((why: string) => {
    setReason(why);
    setError("");
    dialog.current?.showModal();
  }, []);

  const requireAuth = useCallback((why: string, then?: (u: SessionUser) => void) => {
    if (user) { then?.(user); return; }
    pending.current = then ?? null;
    open(why);
  }, [user, open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { user: u } = await api<{ user: SessionUser }>("/api/v1/auth/signin", { body: { email: f.get("email"), displayName: f.get("displayName") } });
      setUser(u);
      dialog.current?.close();
      const cb = pending.current;
      pending.current = null;
      router.refresh();
      cb?.(u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api("/api/v1/auth/signout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <Ctx.Provider value={{ user, requireAuth, signOut, openSignIn: () => open("Sign in to vote, comment and follow discussions.") }}>
      {children}
      <dialog ref={dialog} className="fp-dialog" aria-labelledby="signin-title" onClose={() => { pending.current = null; }}>
        <form className="fp-dialog__body" onSubmit={submit} noValidate>
          <div className="fp-stack-sm">
            <h2 id="signin-title" className="fp-card-title">Sign in to FanPulse</h2>
            <p className="fp-meta">{reason} Reading is always free; an account is only needed to take part.</p>
          </div>
          <div className="fp-field">
            <label className="fp-label" htmlFor="si-email">Email</label>
            <input id="si-email" name="email" type="email" autoComplete="email" required className="fp-input" placeholder="pat@example.com" aria-describedby={error ? "si-err" : undefined} aria-invalid={!!error || undefined} />
          </div>
          <div className="fp-field">
            <label className="fp-label" htmlFor="si-name">Display name</label>
            <input id="si-name" name="displayName" autoComplete="nickname" required minLength={2} maxLength={30} className="fp-input" placeholder="Pat from Ohio" />
            <span className="fp-hint">Shown next to your comments. Your email is never shown.</span>
          </div>
          {error && <p id="si-err" className="fp-error" role="alert">{error}</p>}
          <p className="fp-hint">Prototype sign-in: no email is sent. Creating an account does not sign you up for newsletters.</p>
          <div className="fp-btn-row">
            <button className="fp-btn fp-btn--primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
            <button className="fp-btn fp-btn--ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </Ctx.Provider>
  );
}

export function AuthButton() {
  const { user, signOut, openSignIn } = useAuth();
  if (!user) return <button className="fp-btn fp-btn--sm" onClick={openSignIn}>Sign in</button>;
  return (
    <div className="fp-btn-row">
      <span className="fp-meta" aria-label={`Signed in as ${user.displayName}`}>{user.displayName}{user.role === "editor" ? " · Editor" : ""}</span>
      <button className="fp-btn fp-btn--sm fp-btn--ghost" onClick={signOut}>Sign out</button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/** Private sharing: copy the link or open an email draft. Nothing is posted publicly. */
export function ShareButtons({ path, title, what = "debate" }: { path: string; title: string; what?: string }) {
  const [msg, setMsg] = useState("");
  const url = () => new URL(path, window.location.origin).toString();
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setMsg("Link copied.");
    } catch {
      setMsg(`Copy this link: ${url()}`);
    }
    track("share_clicked", { method: "copy", path });
  }
  function email() {
    track("share_clicked", { method: "email", path });
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\nSee the numbers and have your say on ES FanPulse:\n${url()}`)}`;
  }
  return (
    <div className="fp-btn-row fp-share">
      <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" onClick={copy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        Copy link
      </button>
      <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost" onClick={email}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        Email this {what}
      </button>
      <span className="fp-meta" role="status">{msg}</span>
    </div>
  );
}

import Link from "next/link";
import { getProvider } from "@/lib/data/provider";
import type { User } from "@/lib/store/types";
import { AuthButton } from "./client/AuthProvider";
import { ThemeToggle } from "./client/ThemeToggle";

export function BrandMark() {
  return (
    <svg className="fp-brand__mark" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="var(--es-brand-fill)" />
      <path d="M6 19h6l3-7 5 13 3-6h7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader({ user, current }: { user: User | null; current?: "home" | "editor" }) {
  return (
    <header className="fp-header">
      <div className="fp-container fp-header__row">
        <Link href="/fanpulse" className="fp-brand" aria-label="ES FanPulse home">
          <BrandMark />
          <span className="fp-brand__name">ES <span>FanPulse</span><span className="fp-brand__sub">NFL stats and fan debate</span></span>
        </Link>
        <nav className="fp-nav" aria-label="Main">
          <Link href="/fanpulse" aria-current={current === "home" ? "page" : undefined}>NFL matchups</Link>
          {user?.role === "editor" && <Link href="/fanpulse/editor" aria-current={current === "editor" ? "page" : undefined}>Editor tools</Link>}
        </nav>
        <div className="fp-header__tools">
          <ThemeToggle />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}

export function DemoBanner() {
  if (!getProvider().isDemo) return null;
  return (
    <div className="fp-demo" role="note">
      <div className="fp-container">
        <strong>Demo data.</strong>
        <span>Teams, players and numbers on this prototype are fictional. A licensed stats provider replaces them before launch.</span>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="fp-footer">
      <div className="fp-container">
        <p>ES FanPulse prototype · an EssentiallySports concept. Evidence cards show statistics; they are not editorial endorsements.</p>
        <p>Not a betting, fantasy or gambling product.</p>
      </div>
    </footer>
  );
}

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h} hr ${m} min ago` : `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function Freshness({ period }: { period?: string }) {
  const f = getProvider().freshness();
  // eslint-disable-next-line react-hooks/purity -- server render time is the reference point
  const now = Date.now();
  const stale = now - Date.parse(f.ingestedAt) > f.staleAfterMinutes * 60000;
  const at = new Date(f.ingestedAt);
  return (
    <p className="fp-fresh">
      {period && <span>{period}</span>}
      {period && <span aria-hidden="true">·</span>}
      <span>Updated <time dateTime={f.ingestedAt} title={at.toUTCString()}>{ago(f.ingestedAt, now)}</time></span>
      <span aria-hidden="true">·</span>
      <span>Source: {f.source}</span>
      {stale && <span className="fp-fresh__stale" role="status">Stats may be out of date. We&apos;re checking for an update.</span>}
    </p>
  );
}

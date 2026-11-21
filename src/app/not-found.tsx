import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="fp-main">
      <div className="fp-container">
        <div className="fp-card fp-empty">
          <h1 className="fp-page-title" style={{ fontSize: 32 }}>We couldn&apos;t find that page</h1>
          <p>The matchup or discussion may have moved or been archived.</p>
          <Link href="/fanpulse" className="fp-btn fp-btn--primary">Go to NFL matchups</Link>
        </div>
      </div>
    </main>
  );
}

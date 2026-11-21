"use client";

/** Shown when stats can't be loaded (e.g. the stats API is down and there is no earlier copy). */
export default function StatsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="fp-main">
      <div className="fp-container">
        <div className="fp-card fp-empty" role="alert">
          <p className="fp-empty__title">Stats are unavailable right now</p>
          <p>We couldn&apos;t reach the stats service. Please try again in a minute.</p>
          <button type="button" className="fp-btn fp-btn--primary" onClick={reset}>Try again</button>
        </div>
      </div>
    </main>
  );
}

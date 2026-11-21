import type { Article } from "@/lib/data/types";

/** Reserved-height ad slot so ads never shift the layout (PRD §13, §17). */
export function AdSlot({ wide }: { wide?: boolean }) {
  return <aside className={`fp-ad${wide ? " fp-ad--wide" : ""}`} aria-label="Advertisement">Advertisement</aside>;
}

export function RelatedCoverage({ articles, sample = true }: { articles: Article[]; sample?: boolean }) {
  return (
    <section className="fp-card" aria-labelledby="related-title">
      <h2 id="related-title" className="fp-section-title" style={{ fontSize: 22, marginBottom: 12 }}>Related coverage</h2>
      {articles.length === 0 ? (
        <p className="fp-meta">No related stories yet.</p>
      ) : (
        <ul className="fp-list">
          {articles.map((a) => (
            <li key={a.id}><a href={a.url}>{a.title}</a></li>
          ))}
        </ul>
      )}
      {sample && <p className="fp-hint" style={{ marginTop: 12 }}>Sample headlines. Live builds pull matching EssentiallySports stories.</p>}
    </section>
  );
}

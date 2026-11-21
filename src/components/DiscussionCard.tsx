import Link from "next/link";
import type { DiscussionCard as Card } from "@/lib/server/view";
import { discussionPath, matchupPath } from "@/lib/server/view";
import { Crest } from "./Team";

export function DiscussionCardView({ card, showMatchup = true }: { card: Card; showMatchup?: boolean }) {
  const d = card.discussion;
  const lead = card.poll.total > 0 ? [...card.poll.options].sort((a, b) => b.votes - a.votes)[0] : null;
  return (
    <article className="fp-card fp-disc-card">
      {showMatchup && (
        <div className="fp-matchup-row">
          <Crest team={card.away} size="sm" />
          <Crest team={card.home} size="sm" />
          <Link href={matchupPath(card.game.id)} className="fp-meta">{card.away.name} at {card.home.name} · Week {card.game.week}</Link>
          {d.status === "locked" && <span className="fp-badge">Closed</span>}
        </div>
      )}
      <h3 className="fp-disc-card__q"><Link href={discussionPath(d)}>{d.question}</Link></h3>
      <p className="fp-meta">{d.context}</p>
      <ul className="fp-meta-list">
        <li>{card.poll.total.toLocaleString()} vote{card.poll.total === 1 ? "" : "s"}</li>
        <li>{card.comments.toLocaleString()} comment{card.comments === 1 ? "" : "s"}</li>
        {lead && <li>Leading: {lead.label}</li>}
      </ul>
      <div><Link href={discussionPath(d)} className="fp-btn fp-btn--sm">Vote and discuss</Link></div>
    </article>
  );
}

import Link from "next/link";
import type { DiscussionCard as Card } from "@/lib/server/view";
import { discussionPath, matchupPath } from "@/lib/server/view";
import { Crest } from "./Team";
import { Chevron } from "./Chevron";

export function DiscussionCardView({ card, showMatchup = true }: { card: Card; showMatchup?: boolean }) {
  const d = card.discussion;
  const lead = card.poll.total > 0 ? [...card.poll.options].sort((a, b) => b.votes - a.votes)[0] : null;
  return (
    <article className="fp-card fp-disc-card">
      {showMatchup && (
        <div className="fp-matchup-row">
          <span className="fp-logo-pair" aria-hidden="true">
            <Crest team={card.away} size="sm" />
            <Crest team={card.home} size="sm" />
          </span>
          <Link href={matchupPath(card.game.id)} className="fp-meta">{card.away.name} at {card.home.name} · Week {card.game.week}</Link>
          {d.status === "locked" && <span className="fp-badge">Closed</span>}
        </div>
      )}
      <h3 className="fp-disc-card__q"><Link href={discussionPath(d)}>{d.question}</Link></h3>
      <p className="fp-disc-card__ctx">{d.context}</p>
      {lead && (
        <div className="fp-disc-card__lead">
          <div className="fp-result__row"><span>Leading: <b>{lead.label}</b></span><strong>{lead.pct}%</strong></div>
          <div className="fp-result__bar" aria-hidden="true"><span style={{ width: `${lead.pct}%` }} /></div>
        </div>
      )}
      <div className="fp-disc-card__foot">
        <ul className="fp-chips" aria-label="Activity">
          <li className="fp-chip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
            {card.poll.total.toLocaleString()} vote{card.poll.total === 1 ? "" : "s"}
          </li>
          <li className="fp-chip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.7A8 8 0 1 1 21 12Z" /></svg>
            {card.comments.toLocaleString()} comment{card.comments === 1 ? "" : "s"}
          </li>
          {card.poll.total === 0 && <li className="fp-chip fp-chip--brand">Be the first to vote</li>}
        </ul>
        <Link href={discussionPath(d)} className="fp-btn fp-btn--sm">Vote and discuss <Chevron /></Link>
      </div>
    </article>
  );
}

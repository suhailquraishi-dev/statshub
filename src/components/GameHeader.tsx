import type { Game, Team } from "@/lib/data/types";
import { Crest, kickoff, record, teamVars } from "./Team";

function StatusBadge({ game }: { game: Game }) {
  if (game.status === "final") return <span className="fp-badge fp-badge--solid">Final</span>;
  if (game.status === "postponed") return <span className="fp-badge fp-badge--warn">Postponed</span>;
  return <span className="fp-badge fp-badge--brand">Upcoming</span>;
}

/** Full-width matchup hero: team colours on each side, big logos, score or kickoff in the middle. */
export function GameHeader({ game, home, away }: { game: Game; home: Team; away: Team }) {
  const final = game.status === "final" && game.score;
  const winner = final ? (game.score!.home > game.score!.away ? "home" : game.score!.away > game.score!.home ? "away" : null) : null;
  const side = (t: Team, where: "away" | "home") => (
    <div className={`fp-gamehero__team fp-gamehero__team--${where}${winner && winner !== where ? " is-loser" : ""}`}>
      <Crest team={t} size="xl" />
      <div className="fp-gamehero__names">
        <span className="fp-gamehero__city">{t.city} · {where}</span>
        <span className="fp-gamehero__name">{t.name}</span>
        <span className="fp-gamehero__record">{record(t)} record</span>
      </div>
    </div>
  );
  return (
    <section className="fp-gamehero fp-on-dark" style={teamVars(away, home)} aria-label="Game">
      <div className="fp-gamehero__row">
        {side(away, "away")}
        <div className="fp-gamehero__mid">
          {final ? (
            <p className="fp-gamehero__score" aria-label={`Final score: ${away.name} ${game.score!.away}, ${home.name} ${game.score!.home}`}>
              <span className={winner === "away" ? "is-win" : undefined}>{game.score!.away}</span>
              <span aria-hidden="true" className="fp-gamehero__dash">–</span>
              <span className={winner === "home" ? "is-win" : undefined}>{game.score!.home}</span>
            </p>
          ) : (
            <p className="fp-gamehero__vs" aria-hidden="true">VS</p>
          )}
          <StatusBadge game={game} />
        </div>
        {side(home, "home")}
      </div>
      <ul className="fp-gamehero__meta fp-meta-list">
        <li>Week {game.week}, {game.season} {game.seasonType === "regular" ? "regular season" : "postseason"}</li>
        <li><time dateTime={game.kickoff}>{kickoff(game.kickoff)}</time></li>
        <li>{game.venue}</li>
      </ul>
    </section>
  );
}

import type { Game, Team } from "@/lib/data/types";
import { Crest, kickoff, record } from "./Team";

export function GameHeader({ game, home, away }: { game: Game; home: Team; away: Team }) {
  const status = game.status === "final" ? <span className="fp-badge">Final</span>
    : game.status === "postponed" ? <span className="fp-badge fp-badge--warn">Postponed</span>
    : <span className="fp-badge fp-badge--brand">Upcoming</span>;
  return (
    <div className="fp-card">
      <div className="fp-game">
        <div className="fp-game__team">
          <Crest team={away} />
          <div>
            <p className="fp-game__name"><span className="fp-game__city">{away.city} · away</span>{away.name}</p>
            <p className="fp-meta">{record(away)} record</p>
          </div>
        </div>
        <div className="fp-game__mid">
          {game.status === "final" && game.score ? (
            <p className="fp-game__score" aria-label={`Final score: ${away.name} ${game.score.away}, ${home.name} ${game.score.home}`}>{game.score.away}–{game.score.home}</p>
          ) : (
            <p className="fp-game__at" aria-hidden="true">at</p>
          )}
          {status}
        </div>
        <div className="fp-game__team fp-game__team--home">
          <Crest team={home} />
          <div>
            <p className="fp-game__name"><span className="fp-game__city">{home.city} · home</span>{home.name}</p>
            <p className="fp-meta">{record(home)} record</p>
          </div>
        </div>
      </div>
      <hr className="fp-divider" />
      <ul className="fp-meta-list">
        <li>Week {game.week}, {game.season} {game.seasonType === "regular" ? "regular season" : "postseason"}</li>
        <li><time dateTime={game.kickoff}>{kickoff(game.kickoff)}</time></li>
        <li>{game.venue}</li>
      </ul>
    </div>
  );
}

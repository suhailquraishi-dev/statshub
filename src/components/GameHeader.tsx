import type { Game, Team, TeamResult } from "@/lib/data/types";
import { Crest, kickoff, record } from "./Team";

function StatusBadge({ game }: { game: Game }) {
  if (game.status === "final") return <span className="fp-badge fp-badge--solid">Final</span>;
  if (game.status === "postponed") return <span className="fp-badge fp-badge--warn">Postponed</span>;
  return <span className="fp-badge fp-badge--brand">Upcoming</span>;
}

const ORD = ["th", "st", "nd", "rd"];
export function ordinal(n: number) {
  const v = n % 100;
  return `${n}${ORD[(v - 20) % 10] ?? ORD[v] ?? ORD[0]}`;
}

/** "2nd in AFC East", when the provider knows the division. */
export function divisionLine(t: Team) {
  return t.division && t.divisionRank ? `${ordinal(t.divisionRank)} in ${t.division}` : null;
}

/** Last results as W/L chips: "W 34–22 vs IND". Colour always paired with the letter. */
export function FormChips({ results, abbrOf }: { results: TeamResult[]; abbrOf: (id: string) => string }) {
  if (results.length === 0) return <p className="fp-meta">No finished games yet.</p>;
  return (
    <ul className="fp-form" aria-label="Latest results, newest first">
      {results.map((r) => (
        <li key={r.gameId} className={`fp-form__chip fp-form__chip--${r.result.toLowerCase()}`}>
          <b>{r.result}</b> {r.pf}–{r.pa} <span>{r.home ? "vs" : "at"} {abbrOf(r.opponentId)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Clean scoreboard card for a matchup: logos, names, records, score or kickoff, recent form. */
export function GameHeader({ game, home, away, homeForm, awayForm, abbrOf }: {
  game: Game; home: Team; away: Team; homeForm: TeamResult[]; awayForm: TeamResult[]; abbrOf: (id: string) => string;
}) {
  const final = game.status === "final" && game.score;
  const winner = final ? (game.score!.home > game.score!.away ? "home" : game.score!.away > game.score!.home ? "away" : null) : null;
  const side = (t: Team, where: "away" | "home") => (
    <div className={`fp-board__team fp-board__team--${where}${winner === where ? " is-win" : ""}`}>
      <Crest team={t} size="lg" />
      <div className="fp-board__names">
        <span className="fp-board__city">{where}</span>
        <span className="fp-board__name">{t.city} {t.name}</span>
        <span className="fp-meta">{record(t)}{divisionLine(t) ? ` · ${divisionLine(t)}` : ""}</span>
      </div>
      {final && <span className="fp-board__score" aria-hidden="true">{where === "home" ? game.score!.home : game.score!.away}</span>}
    </div>
  );
  return (
    <section className="fp-card fp-board" aria-label="Game">
      <div className="fp-board__top">
        <StatusBadge game={game} />
        <span className="fp-meta"><time dateTime={game.kickoff}>{kickoff(game.kickoff)}</time> · {game.venue}</span>
      </div>
      {final && <p className="sr-only">Final score: {away.name} {game.score!.away}, {home.name} {game.score!.home}</p>}
      <div className="fp-board__teams">
        {side(away, "away")}
        {side(home, "home")}
      </div>
      <div className="fp-board__form">
        {[{ t: away, f: awayForm }, { t: home, f: homeForm }].map(({ t, f }) => (
          <div key={t.id}>
            <h2 className="fp-eyebrow">{t.name}: last {f.length} games</h2>
            <FormChips results={f} abbrOf={abbrOf} />
          </div>
        ))}
      </div>
      <p className="fp-meta">Week {game.week}, {game.season} {game.seasonType === "regular" ? "regular season" : "postseason"}</p>
    </section>
  );
}

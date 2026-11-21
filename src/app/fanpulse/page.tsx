import Link from "next/link";
import { ensureStats } from "@/lib/data/provider";
import type { Game, Team } from "@/lib/data/types";
import { currentUser } from "@/lib/server/session";
import { matchupPath, rankedDiscussions } from "@/lib/server/view";
import { DemoBanner, Freshness, SiteFooter, SiteHeader } from "@/components/Shell";
import { Crest, kickoff, record } from "@/components/Team";
import { Chevron } from "@/components/Chevron";
import { divisionLine } from "@/components/GameHeader";
import { DiscussionCardView } from "@/components/DiscussionCard";
import { AdSlot } from "@/components/Misc";
import { PageView } from "@/components/client/PageView";
import { Leaders, MyTeam, Standings, type StandingRow, type TeamSummary } from "@/components/client/Home";

export const dynamic = "force-dynamic";

const TZ = "America/New_York";
const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ, timeZoneName: "short" });

/** One schedule row: the whole row is the link, so it is a big, easy target. */
function GameRow({ g, home, away }: { g: Game; home: Team; away: Team }) {
  const final = g.status === "final" && g.score;
  const side = (t: Team, score?: number, win?: boolean) => (
    <span className={`fp-sched__team${final && !win ? " is-loser" : ""}`}>
      <Crest team={t} size="sm" />
      <span className="fp-sched__name"><b>{t.name}</b><span className="fp-meta">{record(t)}</span></span>
      {final && <span className="fp-sched__score">{score}</span>}
    </span>
  );
  const label = `${away.city} ${away.name} at ${home.city} ${home.name}, ${final ? `final, ${g.score!.away} to ${g.score!.home}` : TIME.format(new Date(g.kickoff))}`;
  return (
    <li>
      <Link href={matchupPath(g.id)} className="fp-sched__row" aria-label={label}>
        <span className="fp-sched__when">{final ? "Final" : g.status === "postponed" ? "Postponed" : TIME.format(new Date(g.kickoff))}</span>
        <span className="fp-sched__teams">
          {side(away, g.score?.away, !!final && g.score!.away >= g.score!.home)}
          <span className="fp-sched__at" aria-hidden="true">at</span>
          {side(home, g.score?.home, !!final && g.score!.home >= g.score!.away)}
        </span>
        <Chevron className="fp-sched__chev" />
      </Link>
    </li>
  );
}

export default async function Home() {
  const p = await ensureStats();
  const user = await currentUser();
  const games = p.games();
  const week = games.length ? Math.max(...games.map((g) => g.week)) : null;
  const thisWeek = games.filter((g) => g.week === week).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const byDay = new Map<string, Game[]>();
  for (const g of thisWeek) {
    const d = DAY.format(new Date(g.kickoff));
    byDay.set(d, [...(byDay.get(d) ?? []), g]);
  }
  const teams = p.teams();
  const team = (id: string) => p.team(id)!;

  const summaries: TeamSummary[] = teams.map((t) => {
    const next = p.nextGame(t.id);
    const opp = next && team(next.homeTeamId === t.id ? next.awayTeamId : next.homeTeamId);
    return {
      team: t,
      record: record(t),
      division: divisionLine(t),
      next: next && opp ? { href: matchupPath(next.id), label: `${next.homeTeamId === t.id ? "vs" : "at"} ${opp.city} ${opp.name}`, when: kickoff(next.kickoff) } : null,
      form: p.recentResults(t.id, 5),
    };
  });

  const divisions: Record<string, StandingRow[]> = {};
  for (const t of teams) {
    if (!t.division) continue;
    (divisions[t.division] ??= []).push({ team: t, rank: t.divisionRank ?? 0, w: t.record.w, l: t.record.l, t: t.record.t });
  }
  for (const rows of Object.values(divisions)) rows.sort((a, b) => a.rank - b.rank);

  const discussions = rankedDiscussions(user?.id);

  return (
    <>
      <SiteHeader user={user} current="home" />
      <DemoBanner />
      <main id="main" className="fp-main">
        <PageView props={{ page: "home" }} />
        <div className="fp-container fp-stack">
          <header className="fp-hero">
            {week && <p className="fp-eyebrow">NFL · Week {week}</p>}
            <h1 className="fp-page-title">Check the numbers. Make your case.</h1>
            <p className="fp-lede">Clear stats for every game this week, your team&apos;s form, and a fair place to talk about it.</p>
            <Freshness />
          </header>

          <MyTeam teams={summaries} />

          <div className="fp-layout">
            <div className="fp-stack">
              <section aria-labelledby="sched-title">
                <div className="fp-section-head">
                  <h2 id="sched-title" className="fp-section-title">This week&apos;s games</h2>
                  <span className="fp-meta">Times are Eastern. Pick a game to compare the stats.</span>
                </div>
                {thisWeek.length === 0 ? (
                  <div className="fp-card fp-empty"><p className="fp-empty__title">No games this week</p></div>
                ) : (
                  <div className="fp-card fp-card--flush">
                    {[...byDay.entries()].map(([d, list]) => (
                      <div key={d} className="fp-sched">
                        <h3 className="fp-sched__day">{d}</h3>
                        <ul className="fp-sched__list">
                          {list.map((g) => <GameRow key={g.id} g={g} home={team(g.homeTeamId)} away={team(g.awayTeamId)} />)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="active-title">
                <div className="fp-section-head">
                  <h2 id="active-title" className="fp-section-title">Fan questions</h2>
                  <span className="fp-meta">Written by ES editors from the stats</span>
                </div>
                {discussions.length === 0 ? (
                  <div className="fp-card fp-callout-quiet">
                    <p><b>No questions open yet.</b> Editors post questions before each game. Meanwhile, compare the stats for any game above.</p>
                  </div>
                ) : (
                  <div className="fp-disc-list">{discussions.map((c) => <DiscussionCardView key={c.discussion.id} card={c} />)}</div>
                )}
              </section>
            </div>

            <aside className="fp-aside" aria-label="Standings and leaders">
              <Standings divisions={divisions} fallback={Object.keys(divisions).sort()[0] ?? ""} />
              <Leaders boards={p.leaders()} teams={teams} />
              <AdSlot />
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter user={user} />
    </>
  );
}

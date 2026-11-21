import Link from "next/link";
import { ensureStats } from "@/lib/data/provider";
import type { Game, Team } from "@/lib/data/types";
import { currentUser } from "@/lib/server/session";
import { matchupPath, rankedDiscussions } from "@/lib/server/view";
import { DemoBanner, Freshness, SiteFooter, SiteHeader } from "@/components/Shell";
import { Crest, kickoff, kickoffShort, record, teamVars } from "@/components/Team";
import { DiscussionCardView } from "@/components/DiscussionCard";
import { AdSlot } from "@/components/Misc";
import { PageView } from "@/components/client/PageView";

export const dynamic = "force-dynamic";

function MatchupCard({ g, home, away }: { g: Game; home: Team; away: Team }) {
  return (
    <Link href={matchupPath(g.id)} className="fp-card fp-card--flush fp-mcard" style={teamVars(away, home)}>
      <div className="fp-mcard__band fp-on-dark">
        <Crest team={away} size="lg" />
        <span className="fp-mcard__vs" aria-hidden="true">VS</span>
        <Crest team={home} size="lg" />
      </div>
      <div className="fp-mcard__body">
        <p className="fp-eyebrow">Week {g.week} · {kickoffShort(g.kickoff)}</p>
        <div className="fp-mcard__teams">
          {[away, home].map((t, i) => (
            <p className="fp-mcard__team" key={t.id}>
              <i className="fp-swatch" style={{ background: t.colors[0] }} aria-hidden="true" />
              <b>{t.city} {t.name}</b>
              <span className="fp-meta fp-nowrap">{record(t)}{i === 1 ? " · home" : ""}</span>
            </p>
          ))}
        </div>
        <p className="fp-meta">{g.venue}</p>
        <span className="fp-mcard__cta">Compare the stats <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const p = await ensureStats();
  const user = await currentUser();
  const games = p.games();
  const upcoming = games.filter((g) => g.status === "scheduled");
  // Latest finals first, a short list for the sidebar.
  const recent = games.filter((g) => g.status === "final").sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff)).slice(0, 5);
  const discussions = rankedDiscussions(user?.id);
  const teamGame = (teamId: string) => upcoming.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId) ?? games.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
  // Game of the week: the upcoming game with the top-ranked discussion, else the first kickoff.
  const topGameId = discussions.find((c) => c.game.status === "scheduled")?.game.id;
  const featured = upcoming.find((g) => g.id === topGameId) ?? upcoming[0];
  const fHome = featured && p.team(featured.homeTeamId)!;
  const fAway = featured && p.team(featured.awayTeamId)!;
  const week = featured?.week ?? games[0]?.week;
  const votes = discussions.reduce((n, c) => n + c.poll.total, 0);

  return (
    <>
      <SiteHeader user={user} current="home" />
      <DemoBanner />
      <main id="main" className="fp-main fp-main--flush">
        <PageView props={{ page: "home" }} />

        <section className="fp-hero-band fp-on-dark" aria-labelledby="home-title">
          <div className="fp-container fp-hero-band__grid">
            <div className="fp-hero">
              <p className="fp-eyebrow fp-eyebrow--live"><span className="fp-dot" aria-hidden="true" />NFL · Week {week}</p>
              <h1 id="home-title" className="fp-display">Check the numbers.<br /><span>Make your case.</span></h1>
              <p className="fp-lede">Compare this week&apos;s matchups with clearly labeled stats, vote on the big questions, and back up your take with a stat card.</p>
              <ul className="fp-kpis" aria-label="This week on FanPulse">
                <li><b>{upcoming.length}</b><span>game{upcoming.length === 1 ? "" : "s"} this week</span></li>
                <li><b>{discussions.length}</b><span>open question{discussions.length === 1 ? "" : "s"}</span></li>
                <li><b>{votes.toLocaleString()}</b><span>fan vote{votes === 1 ? "" : "s"} so far</span></li>
              </ul>
              <Freshness />
            </div>

            {featured && fHome && fAway && (
              <article className="fp-feature" style={teamVars(fAway, fHome)} aria-labelledby="gotw-title">
                <p className="fp-feature__tag">Game of the week</p>
                <h2 id="gotw-title" className="sr-only">{fAway.city} {fAway.name} at {fHome.city} {fHome.name}</h2>
                <div className="fp-feature__teams">
                  {[fAway, fHome].map((t, i) => (
                    <div className="fp-feature__team" key={t.id}>
                      <Crest team={t} size="xl" />
                      <span className="fp-feature__city">{t.city}</span>
                      <span className="fp-feature__name">{t.name}</span>
                      <span className="fp-feature__rec">{record(t)}{i === 1 ? " · home" : " · away"}</span>
                    </div>
                  ))}
                  <span className="fp-feature__at" aria-hidden="true">@</span>
                </div>
                <p className="fp-feature__when"><time dateTime={featured.kickoff}>{kickoff(featured.kickoff)}</time><br />{featured.venue}</p>
                <Link href={matchupPath(featured.id)} className="fp-btn fp-btn--primary fp-btn--block">Compare the stats</Link>
              </article>
            )}
          </div>
        </section>

        <div className="fp-container fp-stack fp-after-hero">
          <section aria-labelledby="matchups-title">
            <div className="fp-section-head"><h2 id="matchups-title" className="fp-section-title">This week&apos;s matchups</h2></div>
            <div className="fp-matchups">
              {upcoming.map((g) => <MatchupCard key={g.id} g={g} home={p.team(g.homeTeamId)!} away={p.team(g.awayTeamId)!} />)}
            </div>
          </section>

          <div className="fp-layout">
            <section aria-labelledby="active-title">
              <div className="fp-section-head">
                <h2 id="active-title" className="fp-section-title">Active discussions</h2>
                <span className="fp-meta">Questions written by ES editors from the stats</span>
              </div>
              <div className="fp-disc-list">
                {discussions.length === 0 ? (
                  <div className="fp-card fp-empty"><p className="fp-empty__title">No discussions yet</p><p>Editors post new questions before each game.</p></div>
                ) : discussions.map((c) => <DiscussionCardView key={c.discussion.id} card={c} />)}
              </div>
            </section>
            <aside className="fp-aside" aria-label="More">
              <section className="fp-card" aria-labelledby="teams-title">
                <h2 id="teams-title" className="fp-section-title fp-section-title--sm">Find your team</h2>
                <div className="fp-team-grid">
                  {p.teams().map((t) => {
                    const g = teamGame(t.id);
                    return g ? (
                      <Link key={t.id} href={matchupPath(g.id)} className="fp-team-tile" style={teamVars(t)} aria-label={`${t.city} ${t.name}: this week's matchup`}>
                        <Crest team={t} size="md" />
                        <span className="fp-team-tile__name">{t.name}</span>
                        <span className="fp-meta">{record(t)}</span>
                      </Link>
                    ) : null;
                  })}
                </div>
                <p className="fp-hint" style={{ marginTop: 12 }}>Team pages are coming soon. For now, each team links to its latest game.</p>
              </section>
              {recent.length > 0 && (
                <section className="fp-card" aria-labelledby="recent-title">
                  <h2 id="recent-title" className="fp-section-title fp-section-title--sm">Final scores</h2>
                  <ul className="fp-list">
                    {recent.map((g) => {
                      const home = p.team(g.homeTeamId)!;
                      const away = p.team(g.awayTeamId)!;
                      const rows: [Team, number][] = [[away, g.score!.away], [home, g.score!.home]];
                      const top = Math.max(g.score!.away, g.score!.home);
                      return (
                        <li key={g.id}>
                          <Link href={matchupPath(g.id)} className="fp-final" aria-label={`${away.name} ${g.score!.away}, ${home.name} ${g.score!.home}, final, week ${g.week}`}>
                            {rows.map(([t, s]) => (
                              <span key={t.id} className={`fp-final__row${s === top ? " is-win" : ""}`}>
                                <Crest team={t} size="xs" /><span>{t.name}</span><b>{s}</b>
                              </span>
                            ))}
                            <span className="fp-meta">Week {g.week} · Final</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              <AdSlot />
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

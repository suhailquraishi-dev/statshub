import Link from "next/link";
import { getProvider } from "@/lib/data/provider";
import { currentUser } from "@/lib/server/session";
import { matchupPath, rankedDiscussions } from "@/lib/server/view";
import { DemoBanner, Freshness, SiteFooter, SiteHeader } from "@/components/Shell";
import { Crest, kickoff, record } from "@/components/Team";
import { DiscussionCardView } from "@/components/DiscussionCard";
import { AdSlot } from "@/components/Misc";
import { PageView } from "@/components/client/PageView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const p = getProvider();
  const games = p.games();
  const upcoming = games.filter((g) => g.status === "scheduled");
  const recent = games.filter((g) => g.status === "final");
  const discussions = rankedDiscussions(user?.id);
  const teamGame = (teamId: string) => upcoming.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId) ?? games.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);

  return (
    <>
      <SiteHeader user={user} current="home" />
      <DemoBanner />
      <main id="main" className="fp-main">
        <PageView props={{ page: "home" }} />
        <div className="fp-container fp-stack">
          <section className="fp-hero">
            <p className="fp-eyebrow">NFL · Week 12</p>
            <h1 className="fp-page-title">Check the numbers. Make your case.</h1>
            <p className="fp-lede">Compare this week&apos;s matchups with clearly labeled stats, vote on the big questions, and back up your take with a stat card.</p>
            <Freshness />
          </section>

          <section aria-labelledby="matchups-title">
            <div className="fp-section-head"><h2 id="matchups-title" className="fp-section-title">This week&apos;s matchups</h2></div>
            <div className="fp-matchups">
              {upcoming.map((g) => {
                const home = p.team(g.homeTeamId)!;
                const away = p.team(g.awayTeamId)!;
                return (
                  <Link key={g.id} href={matchupPath(g.id)} className="fp-card fp-matchup-card">
                    <p className="fp-eyebrow">Week {g.week} · {kickoff(g.kickoff)}</p>
                    <div className="fp-matchup-card__teams">
                      {[away, home].map((t, i) => (
                        <div className="fp-matchup-card__team" key={t.id}>
                          <Crest team={t} size="sm" />
                          <span><b>{t.city} {t.name}</b> <span className="fp-meta fp-nowrap">({record(t)}){i === 1 ? " · home" : ""}</span></span>
                        </div>
                      ))}
                    </div>
                    <span className="fp-card-title" style={{ fontSize: 18, color: "var(--es-brand-text)" }}>Compare the stats →</span>
                  </Link>
                );
              })}
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
                <h2 id="teams-title" className="fp-section-title" style={{ fontSize: 22, marginBottom: 12 }}>Find your team</h2>
                <div className="fp-team-chips">
                  {p.teams().map((t) => {
                    const g = teamGame(t.id);
                    return g ? (
                      <Link key={t.id} href={matchupPath(g.id)} className="fp-team-chip" aria-label={`${t.city} ${t.name}: this week's matchup`}>
                        <Crest team={t} size="sm" /> {t.name}
                      </Link>
                    ) : null;
                  })}
                </div>
                <p className="fp-hint" style={{ marginTop: 12 }}>Team pages are coming soon. For now, each team links to its latest game.</p>
              </section>
              {recent.length > 0 && (
                <section className="fp-card" aria-labelledby="recent-title">
                  <h2 id="recent-title" className="fp-section-title" style={{ fontSize: 22, marginBottom: 12 }}>Final scores</h2>
                  <ul className="fp-list">
                    {recent.map((g) => {
                      const home = p.team(g.homeTeamId)!;
                      const away = p.team(g.awayTeamId)!;
                      return (
                        <li key={g.id}>
                          <Link href={matchupPath(g.id)}>{away.name} {g.score!.away}, {home.name} {g.score!.home}</Link>
                          <span className="fp-meta"> · Week {g.week} · Final</span>
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

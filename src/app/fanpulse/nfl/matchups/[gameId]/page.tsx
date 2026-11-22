import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureStats } from "@/lib/data/provider";
import { currentUser } from "@/lib/server/session";
import { discussionCards, discussionPath, evidenceOptions, matchupPath, matchupView, playerBundles } from "@/lib/server/view";
import { isFollowing, listComments } from "@/lib/store/store";
import { DemoBanner, Freshness, SiteFooter, SiteHeader } from "@/components/Shell";
import { GameHeader } from "@/components/GameHeader";
import { AdSlot, Breadcrumbs, RelatedCoverage } from "@/components/Misc";
import { Crest, day } from "@/components/Team";
import { DiscussionCardView } from "@/components/DiscussionCard";
import { AllStats, GameStats, KeyNumbers, PeriodNote, PeriodProvider, PeriodToggle, PlayerSpotlight } from "@/components/client/Stats";
import { ShareButtons } from "@/components/client/Share";
import { Chevron } from "@/components/Chevron";
import { compareGame } from "@/lib/stats/compare";
import { GAME_METRICS } from "@/lib/data/metrics";
import { Poll } from "@/components/client/Poll";
import { Conversation, FollowButton } from "@/components/client/Conversation";
import { PageView } from "@/components/client/PageView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ gameId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { gameId } = await params;
  await ensureStats();
  const v = matchupView(gameId);
  if (!v) return { title: "Matchup not found" };
  const title = `${v.away.city} ${v.away.name} at ${v.home.city} ${v.home.name}: stats and fan debate`;
  return {
    title,
    description: `Compare ${v.away.name} and ${v.home.name} stats for Week ${v.game.week}: full season and last 5 games, with fan polls and discussion.`,
    alternates: { canonical: matchupPath(gameId) },
    openGraph: { title, type: "article" },
  };
}

export default async function MatchupPage({ params }: Params) {
  const { gameId } = await params;
  const p = await ensureStats({ gameId });
  const v = matchupView(gameId);
  if (!v) notFound();
  const user = await currentUser();
  const { game, home, away } = v;
  const cards = discussionCards({ gameId, viewerId: user?.id });
  const featured = cards.find((c) => c.discussion.featured) ?? cards[0];
  const others = cards.filter((c) => c !== featured);
  const h2h = p.headToHead(home.id, away.id);
  const final = game.status === "final" && !!game.score;
  const locked = featured?.discussion.status === "locked";
  const canReply = !!featured && !locked;
  const homeForm = p.recentResults(home.id, 5);
  const awayForm = p.recentResults(away.id, 5);
  const abbr = Object.fromEntries(p.teams().map((t) => [t.id, t.abbr]));
  const gs = final ? p.gameStats(gameId) : null;
  const gameCmp = gs ? compareGame(home, away, game.season, game.seasonType, GAME_METRICS, gs.home, gs.away) : null;
  const resultLine = !final ? "" : game.score!.home === game.score!.away
    ? `${away.name} and ${home.name} tied ${game.score!.away}–${game.score!.home}`
    : game.score!.home > game.score!.away
      ? `${home.name} beat the ${away.name} ${game.score!.home}–${game.score!.away}`
      : `${away.name} beat the ${home.name} ${game.score!.away}–${game.score!.home}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${away.city} ${away.name} at ${home.city} ${home.name}`,
    startDate: game.kickoff,
    eventStatus: game.status === "postponed" ? "https://schema.org/EventPostponed" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: game.venue },
    homeTeam: { "@type": "SportsTeam", name: `${home.city} ${home.name}` },
    awayTeam: { "@type": "SportsTeam", name: `${away.city} ${away.name}` },
    sport: "American football",
  };

  return (
    <>
      <SiteHeader user={user} gameId={gameId} />
      <DemoBanner />
      <main id="main" className="fp-main">
        <PageView props={{ page: "matchup", matchup: gameId }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="fp-container fp-stack">
          <Breadcrumbs items={[{ label: "NFL home", href: "/fanpulse" }, { label: `Week ${game.week}: ${away.name} at ${home.name}` }]} />
          <h1 className="sr-only">{away.city} {away.name} at {home.city} {home.name}</h1>
          <GameHeader game={game} home={home} away={away} homeForm={homeForm} awayForm={awayForm} abbrOf={(id) => abbr[id] ?? id.toUpperCase()} />
          <PeriodProvider gameId={gameId}>
            <div className="fp-layout">
              <div className="fp-stack">
                {final && (
                  <section className="fp-card fp-card--accent fp-stack-sm" aria-labelledby="postgame">
                    <p className="fp-eyebrow">Final · Week {game.week}</p>
                    <h2 id="postgame" className="fp-lead-title">{resultLine}</h2>
                    {featured && (
                      <div className="fp-stack-sm fp-postq">
                        <p className="fp-eyebrow">The pregame question</p>
                        <p className="fp-card-title">{featured.discussion.question}</p>
                        <Poll discussionId={featured.discussion.id} question={featured.discussion.question} initial={featured.poll} locked gameId={gameId} />
                        {featured.discussion.verdict && (
                          <div className="fp-verdict">
                            <p className="fp-eyebrow">Editor&apos;s verdict · {featured.discussion.verdict.by}</p>
                            <p>{featured.discussion.verdict.text}</p>
                          </div>
                        )}
                        <ShareButtons path={discussionPath(featured.discussion)} title={featured.discussion.question} />
                      </div>
                    )}
                    <h3 className="fp-eyebrow">This game&apos;s numbers</h3>
                    {gameCmp ? <GameStats c={gameCmp} home={home} away={away} /> : <p className="fp-meta">Game-by-game numbers aren&apos;t available for this game. The final score is above.</p>}
                  </section>
                )}

                {!final && featured && (
                  <section className="fp-card fp-card--accent fp-stack-sm" aria-labelledby="featured-q">
                    <p className="fp-eyebrow">The matchup question · ES Editorial</p>
                    <h2 id="featured-q" className="fp-lead-title">{featured.discussion.question}</h2>
                    <p className="fp-lede">{featured.discussion.context}</p>
                    <Poll discussionId={featured.discussion.id} question={featured.discussion.question} initial={featured.poll} locked={locked} gameId={gameId} />
                    <div className="fp-btn-row">
                      <Link href={discussionPath(featured.discussion)} className="fp-btn fp-btn--sm fp-btn--ghost">Read the fan discussion ({featured.comments}) <Chevron /></Link>
                      <FollowButton discussionId={featured.discussion.id} initial={isFollowing(user?.id, featured.discussion.id)} postgame />
                    </div>
                    <ShareButtons path={discussionPath(featured.discussion)} title={featured.discussion.question} />
                  </section>
                )}

                <section className="fp-card fp-stack-sm" aria-labelledby="key-stats">
                  <div className="fp-section-head" style={{ marginBottom: 0 }}>
                    <h2 id="key-stats" className="fp-section-title">{final ? "Where the teams stand now" : "Two numbers to know"}</h2>
                    <PeriodToggle label="Stats period for this page" />
                  </div>
                  {final && <p className="fp-meta">These are the teams&apos; current numbers, not from this game. Stat cards in comments keep the numbers from when they were posted.</p>}
                  <KeyNumbers data={v.quick} home={home} away={away} homeForm={homeForm} awayForm={awayForm} abbr={abbr} canReply={canReply} />
                  <Freshness />
                  <details className="fp-details">
                    <summary>Explore all stats <Chevron direction="down" /></summary>
                    <AllStats quick={v.quick} categories={v.categories} home={home} away={away} canReply={canReply} />
                  </details>
                </section>

                <section className="fp-card" aria-labelledby="players">
                  <div className="fp-section-head">
                    <h2 id="players" className="fp-section-title">Player spotlight</h2>
                    <span className="fp-meta">Showing: <PeriodNote /></span>
                  </div>
                  <PlayerSpotlight home={home} away={away} homePlayers={playerBundles(home.id, game.season)} awayPlayers={playerBundles(away.id, game.season)} />
                </section>

                <section className="fp-card" aria-labelledby="h2h">
                  <h2 id="h2h" className="fp-section-title" style={{ marginBottom: 12 }}>Head-to-head</h2>
                  <p className="fp-meta" style={{ marginBottom: 8 }}>Recent meetings, newest first.</p>
                  {h2h.length === 0 ? (
                    <p className="fp-meta">These teams haven&apos;t met in the seasons we have data for.</p>
                  ) : (
                    <ul className="fp-list">
                      {h2h.map((m) => {
                        const mh = p.team(m.homeTeamId)!;
                        const ma = p.team(m.awayTeamId)!;
                        const winner = m.score.home === m.score.away ? null : m.score.home > m.score.away ? mh : ma;
                        return (
                          <li key={m.gameId} className="fp-h2h">
                            <span className="fp-h2h__score">
                              <span className={winner === ma ? "is-win" : undefined}><Crest team={ma} size="xs" />{ma.name} <b>{m.score.away}</b></span>
                              <span className={winner === mh ? "is-win" : undefined}><Crest team={mh} size="xs" />{mh.name} <b>{m.score.home}</b></span>
                            </span>
                            <span className="fp-h2h__info">
                              <span className={`fp-badge${winner ? " fp-badge--solid" : ""}`}>{winner ? `${winner.name} won` : "Tie"}</span>
                              <span className="fp-meta">{day(m.date)} · {m.seasonType === "postseason" ? "Postseason" : "Regular season"} · at {mh.city}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {featured && (
                  <section className="fp-card" aria-label="Conversation">
                    <p className="fp-eyebrow" style={{ marginBottom: 8 }}>On: {featured.discussion.question}</p>
                    <Conversation discussionId={featured.discussion.id} gameId={gameId} initial={listComments(featured.discussion.id, user?.id)} locked={featured.discussion.status === "locked"} evidenceOpts={evidenceOptions(gameId)} />
                  </section>
                )}

                {others.length > 0 && (
                  <section aria-labelledby="more-q">
                    <h2 id="more-q" className="fp-section-title" style={{ marginBottom: 16 }}>More questions on this game</h2>
                    <div className="fp-disc-list">{others.map((c) => <DiscussionCardView key={c.discussion.id} card={c} showMatchup={false} />)}</div>
                  </section>
                )}
              </div>
              <aside className="fp-aside" aria-label="Related">
                <RelatedCoverage articles={p.relatedArticles([home.id, away.id])} sample={p.isDemo} />
                <AdSlot />
              </aside>
            </div>
          </PeriodProvider>
        </div>
      </main>
      <SiteFooter user={user} />
    </>
  );
}

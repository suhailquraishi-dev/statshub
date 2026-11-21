import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ensureStats } from "@/lib/data/provider";
import { currentUser } from "@/lib/server/session";
import { discussionPath, evidenceOptions, matchupPath, matchupView, parseDiscussionParam } from "@/lib/server/view";
import { commentCount, getDiscussion, isFollowing, listComments, pollResults } from "@/lib/store/store";
import { DemoBanner, Freshness, SiteFooter, SiteHeader } from "@/components/Shell";
import { AdSlot, RelatedCoverage } from "@/components/Misc";
import { Crest, teamVars } from "@/components/Team";
import { PeriodProvider, PeriodToggle, QuickStats } from "@/components/client/Stats";
import { Poll } from "@/components/client/Poll";
import { Conversation, FollowButton } from "@/components/client/Conversation";
import { PageView } from "@/components/client/PageView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ param: string }> };

/** Pages with fewer than this many visible comments are noindexed as thin (PRD §14). */
const INDEX_MIN_COMMENTS = 3;

function load(param: string) {
  const d = getDiscussion(parseDiscussionParam(param));
  if (!d || d.status === "pending" || d.status === "archived") return null;
  return d;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { param } = await params;
  const p = await ensureStats();
  const d = load(param);
  if (!d) return { title: "Discussion not found" };
  const thin = commentCount(d.id) < INDEX_MIN_COMMENTS;
  return {
    title: d.question,
    description: d.context,
    alternates: { canonical: discussionPath(d) },
    robots: thin || p.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function DiscussionPage({ params }: Params) {
  const { param } = await params;
  const d = load(param);
  if (!d) notFound();
  // Old or edited slugs resolve to the canonical URL.
  if (param !== `${d.id}-${d.slug}`) permanentRedirect(discussionPath(d));
  const p = await ensureStats({ gameId: d.gameId });
  const user = await currentUser();
  const v = matchupView(d.gameId)!;
  const comments = listComments(d.id, user?.id);
  const locked = d.status === "locked";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: d.question,
    text: d.context,
    datePublished: d.createdAt,
    author: { "@type": "Organization", name: "EssentiallySports" },
    interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: commentCount(d.id) },
  };

  return (
    <>
      <SiteHeader user={user} gameId={d.gameId} />
      <DemoBanner />
      <main id="main" className="fp-main">
        <PageView event="discussion_viewed" props={{ matchup: d.gameId, discussion: d.id }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="fp-container fp-stack">
          <nav aria-label="Breadcrumb" className="fp-meta">
            <Link href="/fanpulse">NFL matchups</Link> / <Link href={matchupPath(d.gameId)}>{v.away.name} at {v.home.name}</Link> / Discussion
          </nav>
          <PeriodProvider gameId={d.gameId}>
            <div className="fp-layout">
              <div className="fp-stack">
                <section className="fp-card fp-card--team fp-stack-sm" aria-labelledby="q" style={teamVars(v.away, v.home)}>
                  <div className="fp-matchup-row">
                    <span className="fp-logo-pair" aria-hidden="true"><Crest team={v.away} size="sm" /><Crest team={v.home} size="sm" /></span>
                    <span className="fp-meta">{v.away.city} {v.away.name} at {v.home.city} {v.home.name} · Week {v.game.week}</span>
                    {locked && <span className="fp-badge">Closed</span>}
                  </div>
                  <h1 id="q" className="fp-page-title">{d.question}</h1>
                  <p className="fp-lede">{d.context}</p>
                  <p className="fp-hint">Question by ES Editorial, based on the stats below. Results reflect FanPulse voters, not all fans.</p>
                  <Poll discussionId={d.id} question={d.question} initial={pollResults(d.id, user?.id)} locked={locked} gameId={d.gameId} />
                  <div className="fp-btn-row"><FollowButton discussionId={d.id} initial={isFollowing(user?.id, d.id)} /></div>
                </section>

                <section className="fp-card" aria-labelledby="stats-h">
                  <div className="fp-section-head">
                    <h2 id="stats-h" className="fp-section-title">The numbers</h2>
                    <PeriodToggle />
                  </div>
                  <div className="fp-stack-sm">
                    <QuickStats data={v.quick} home={v.home} away={v.away} />
                    <Freshness />
                    <Link href={matchupPath(d.gameId)}>See the full matchup comparison</Link>
                  </div>
                </section>

                <section className="fp-card">
                  <Conversation discussionId={d.id} gameId={d.gameId} initial={comments} locked={locked} evidenceOpts={evidenceOptions(d.gameId)} />
                </section>
              </div>
              <aside className="fp-aside" aria-label="Related">
                <RelatedCoverage articles={p.relatedArticles([v.home.id, v.away.id])} sample={p.isDemo} />
                <AdSlot />
              </aside>
            </div>
          </PeriodProvider>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

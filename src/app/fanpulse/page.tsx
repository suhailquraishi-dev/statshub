import Link from "next/link";
import { ensureStats } from "@/lib/data/provider";
import type { Game, Team } from "@/lib/data/types";
import { currentUser } from "@/lib/server/session";
import { discussionPath, matchupPath, matchupView, rankedDiscussions, teamSummaries } from "@/lib/server/view";
import { keyNumbers } from "@/lib/stats/compare";
import { Poll } from "@/components/client/Poll";
import { ShareButtons } from "@/components/client/Share";
import { DemoBanner, Freshness, SiteFooter, SiteHeader } from "@/components/Shell";
import { Crest, kickoff, record } from "@/components/Team";
import { Chevron } from "@/components/Chevron";
import { divisionLine } from "@/components/GameHeader";
import { DiscussionCardView } from "@/components/DiscussionCard";
import { AdSlot } from "@/components/Misc";
import { PageView } from "@/components/client/PageView";
import { Leaders, MyTeamShortcut, Standings, type StandingRow } from "@/components/client/Home";

export const dynamic = "force-dynamic";

const TZ = "America/New_York";
const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ, timeZoneName: "short" });

/** One scoreboard entry: teams stacked, scores in one right-aligned column. The whole entry is one link. */
function GameRow({ g, home, away }: { g: Game; home: Team; away: Team }) {
  const final = g.status === "final" && g.score;
  const tie = final && g.score!.home === g.score!.away;
  const state = final ? "Final" : g.status === "postponed" ? "Postponed" : TIME.format(new Date(g.kickoff));
  const side = (t: Team, where: "away" | "home", score?: number) => {
    const win = !!final && !tie && score === Math.max(g.score!.home, g.score!.away);
    return (
      <span className={`fp-game-row__team${win ? " is-win" : ""}`}>
        <Crest team={t} size="sm" />
        <span className="fp-game-row__name">{t.city} {t.name} <span className="fp-meta fp-nowrap">{record(t)}{where === "home" ? " · home" : ""}</span></span>
        <span className="fp-game-row__score">{final ? score : ""}</span>
      </span>
    );
  };
  const label = `${away.city} ${away.name} at ${home.city} ${home.name}, ${final ? `final, ${away.name} ${g.score!.away}, ${home.name} ${g.score!.home}` : state}`;
  return (
    <li>
      <Link href={matchupPath(g.id)} className="fp-game-row" aria-label={label}>
        <span className={`fp-game-row__state${final ? " is-final" : ""}`}>{state}</span>
        <span className="fp-game-row__teams">
          {side(away, "away", g.score?.away)}
          {side(home, "home", g.score?.home)}
        </span>
        <Chevron className="fp-game-row__chev" />
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

  const summaries = teamSummaries();

  const divisions: Record<string, StandingRow[]> = {};
  for (const t of teams) {
    if (!t.division) continue;
    (divisions[t.division] ??= []).push({ team: t, rank: t.divisionRank ?? 0, w: t.record.w, l: t.record.l, t: t.record.t });
  }
  for (const rows of Object.values(divisions)) rows.sort((a, b) => a.rank - b.rank);

  const discussions = rankedDiscussions(user?.id);

  // Lead: the top open question on an upcoming game; with no question yet, the upcoming game between the
  // two best records. Its two key numbers come from the same comparison the matchup page shows.
  const upcoming = thisWeek.filter((g) => g.status === "scheduled");
  const lead = discussions.find((c) => c.game.status === "scheduled" && c.discussion.status === "published") ?? null;
  const pct = (t: Team) => (t.record.w + t.record.t / 2) / Math.max(1, t.record.w + t.record.l + t.record.t);
  const leadGame = lead?.game ?? [...upcoming].sort((a, b) => pct(team(b.homeTeamId)) + pct(team(b.awayTeamId)) - pct(team(a.homeTeamId)) - pct(team(a.awayTeamId)))[0] ?? null;
  const lv = leadGame ? matchupView(leadGame.id) : null;
  const leadCmp = lv ? (keyNumbers(lv.quick.last5).length >= 2 ? lv.quick.last5 : lv.quick.season) : null;
  const leadKeys = leadCmp ? keyNumbers(leadCmp) : [];
  const rest = discussions.filter((c) => c !== lead);

  return (
    <>
      <SiteHeader user={user} current="home" />
      <DemoBanner />
      <main id="main" className="fp-main">
        <PageView props={{ page: "home" }} />
        <div className="fp-container fp-stack">
          {lv && leadGame ? (
            <section className="fp-card fp-card--accent fp-lead" aria-labelledby="lead-title">
              <p className="fp-lead__kicker">
                <span className="fp-eyebrow">NFL / Week {leadGame.week}</span>
                <span className="fp-lead__match"><Crest team={lv.away} size="xs" /><span className="fp-eyebrow">{lv.away.city} {lv.away.name} at {lv.home.city} {lv.home.name}</span><Crest team={lv.home} size="xs" /></span>
                <span className="fp-meta">{kickoff(leadGame.kickoff)}</span>
              </p>
              {lead ? (
                <>
                  <p className="fp-meta">The matchup question · ES Editorial</p>
                  <h1 id="lead-title" className="fp-lead-title">{lead.discussion.question}</h1>
                </>
              ) : (
                <h1 id="lead-title" className="fp-lead-title">{lv.away.name} at {lv.home.name}: two numbers to know</h1>
              )}
              {leadKeys.length > 0 && leadCmp && (
                <>
                  <div className="fp-keys">
                    {leadKeys.map((r) => (
                      <div className="fp-key" key={r.metric.code}>
                        <p className="fp-eyebrow">{r.metric.label} · {leadCmp.periodLabel.toLowerCase()}</p>
                        <div className="fp-key__vals">
                          {[{ t: lv.away, text: r.awayText, win: r.edge === "away" }, { t: lv.home, text: r.homeText, win: r.edge === "home" }].map(({ t, text, win }) => (
                            <p key={t.id} className={`fp-key__side${win ? " is-lead" : ""}`}>
                              <span className="fp-key__team"><Crest team={t} size="xs" />{t.name}</span>
                              <span className="fp-key__num">{text}</span>
                              {win && <span className="fp-compare__edge">✓ Edge</span>}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="fp-lede">{leadCmp.insights[0]}</p>
                </>
              )}
              {lead && <Poll discussionId={lead.discussion.id} question={lead.discussion.question} initial={lead.poll} gameId={leadGame.id} />}
              <div className="fp-btn-row">
                <Link href={matchupPath(leadGame.id)} className="fp-btn">Compare the stats <Chevron /></Link>
                {lead && <Link href={discussionPath(lead.discussion)} className="fp-btn fp-btn--ghost">Read the fan discussion ({lead.comments}) <Chevron /></Link>}
              </div>
              {lead && <ShareButtons path={discussionPath(lead.discussion)} title={lead.discussion.question} />}
              <Freshness />
            </section>
          ) : (
            <header className="fp-hero">
              {week && <p className="fp-eyebrow">NFL · Week {week}</p>}
              <h1 className="fp-page-title">NFL stats and fan debate</h1>
              <Freshness />
            </header>
          )}

          <div className="fp-layout">
            <div className="fp-stack">
              <MyTeamShortcut teams={summaries} />
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
                        <ul className="fp-sched__list fp-sched__list--grid">
                          {list.map((g) => <GameRow key={g.id} g={g} home={team(g.homeTeamId)} away={team(g.awayTeamId)} />)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="active-title">
                <div className="fp-section-head">
                  <h2 id="active-title" className="fp-section-title">{lead ? "More fan questions" : "Fan questions"}</h2>
                  <span className="fp-meta">Written by ES editors from the stats</span>
                </div>
                {rest.length === 0 ? (
                  <div className="fp-card fp-callout-quiet">
                    <p>{lead ? "That's the only open question right now." : "No questions open yet."} Editors post new questions before each game. Meanwhile, compare the stats for any game above.</p>
                  </div>
                ) : (
                  <div className="fp-disc-list">{rest.map((c) => <DiscussionCardView key={c.discussion.id} card={c} />)}</div>
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

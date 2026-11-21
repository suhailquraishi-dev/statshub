import type { Metadata } from "next";
import Link from "next/link";
import { getProvider } from "@/lib/data/provider";
import { currentUser } from "@/lib/server/session";
import { auditLog, commentCount, listDiscussions, moderationQueue, pollResults } from "@/lib/store/store";
import { findSignals } from "@/lib/stats/signals";
import { discussionPath } from "@/lib/server/view";
import { DemoBanner, SiteFooter, SiteHeader } from "@/components/Shell";
import { CreateDiscussion, DiscussionActions, CommentActions, SignalDraft } from "@/components/client/Editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editor tools", robots: { index: false, follow: false } };

const TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function EditorPage() {
  const user = await currentUser();
  if (!user || user.role !== "editor") {
    return (
      <>
        <SiteHeader user={user} current="editor" />
        <main id="main" className="fp-main">
          <div className="fp-container">
            <div className="fp-card fp-empty">
              <h1 className="fp-page-title" style={{ fontSize: 32 }}>Editor tools</h1>
              <p>{user ? "Your account doesn't have editor access." : "Sign in with an EssentiallySports email to use editor tools."}</p>
              <Link href="/fanpulse" className="fp-btn">Back to FanPulse</Link>
            </div>
          </div>
        </main>
      </>
    );
  }
  const p = getProvider();
  const pending = listDiscussions({ statuses: ["pending"] });
  const live = listDiscussions({ statuses: ["published", "locked"] });
  const queue = moderationQueue(user.id);
  const signals = findSignals(p).slice(0, 6);
  const log = auditLog(user.id, 25);
  const label = (gameId: string) => {
    const g = p.game(gameId)!;
    return `${p.team(g.awayTeamId)!.name} at ${p.team(g.homeTeamId)!.name}`;
  };
  const games = p.games().map((g) => ({ id: g.id, label: `Week ${g.week}: ${label(g.id)}` }));

  return (
    <>
      <SiteHeader user={user} current="editor" />
      <DemoBanner />
      <main id="main" className="fp-main">
        <div className="fp-container fp-stack">
          <div className="fp-hero">
            <p className="fp-eyebrow">Editorial</p>
            <h1 className="fp-page-title">Editor tools</h1>
            <p className="fp-lede">Approve questions, feature one per matchup, close discussions and review reported comments. Every action is logged.</p>
          </div>

          <section className="fp-card" aria-labelledby="queue-h">
            <div className="fp-section-head">
              <h2 id="queue-h" className="fp-section-title">Moderation queue</h2>
              <span className="fp-badge">{queue.length} to review</span>
            </div>
            {queue.length === 0 ? (
              <p className="fp-meta">Nothing to review. Reported and auto-held comments appear here, most severe first.</p>
            ) : (
              <ul className="fp-comments">
                {queue.map((q) => (
                  <li key={q.comment.id} className="fp-comment">
                    <div className="fp-comment__head">
                      <span className={`fp-badge ${q.severity === "high" ? "fp-badge--bad" : q.severity === "medium" ? "fp-badge--warn" : ""}`}>{q.severity === "high" ? "High" : q.severity === "medium" ? "Medium" : "Low"} priority</span>
                      <span className="fp-comment__author">{q.authorName}</span>
                      <span className="fp-meta">on “{q.discussionQuestion}” · {TIME.format(new Date(q.comment.createdAt))}</span>
                    </div>
                    <p className="fp-comment__body">{q.comment.body}</p>
                    <p className="fp-meta">
                      {q.comment.status === "held" ? "Held by the automatic screen. " : ""}
                      {q.reports.length > 0 && `Reports: ${q.reports.map((r) => r.reason).join(", ")}`}
                    </p>
                    <CommentActions commentId={q.comment.id} status={q.comment.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="fp-card" aria-labelledby="pending-h">
            <div className="fp-section-head">
              <h2 id="pending-h" className="fp-section-title">Waiting for approval</h2>
              <span className="fp-badge">{pending.length}</span>
            </div>
            {pending.length === 0 ? <p className="fp-meta">No drafts waiting. Create one below or start from a stat signal.</p> : (
              <ul className="fp-list">
                {pending.map((d) => (
                  <li key={d.id} className="fp-stack-sm">
                    <p style={{ fontWeight: 600 }}>{d.question}</p>
                    <p className="fp-meta">{label(d.gameId)} · {d.source === "signal" ? "From a stat signal" : "Written by an editor"} · Choices: {d.poll.options.map((o) => o.label).join(" / ")}</p>
                    {d.context && <p className="fp-meta">{d.context}</p>}
                    <DiscussionActions id={d.id} status={d.status} featured={d.featured} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="fp-grid-2">
            <section className="fp-card" aria-labelledby="signals-h">
              <h2 id="signals-h" className="fp-section-title" style={{ marginBottom: 8 }}>Stat signals</h2>
              <p className="fp-meta" style={{ marginBottom: 12 }}>Notable changes between full season and last 5 games, found automatically. Drafts need your approval before anyone sees them.</p>
              {signals.length === 0 ? <p className="fp-meta">No notable changes right now.</p> : (
                <ul className="fp-list">
                  {signals.map((s) => <li key={s.id}><SignalDraft signal={s} matchupLabel={label(s.gameId)} /></li>)}
                </ul>
              )}
            </section>
            <section className="fp-card" aria-labelledby="create-h">
              <h2 id="create-h" className="fp-section-title" style={{ marginBottom: 12 }}>New question</h2>
              <CreateDiscussion games={games} />
            </section>
          </div>

          <section className="fp-card" aria-labelledby="live-h">
            <h2 id="live-h" className="fp-section-title" style={{ marginBottom: 12 }}>Live discussions</h2>
            <div className="fp-table-wrap">
              <table className="fp-table">
                <thead><tr><th scope="col">Question</th><th scope="col">Matchup</th><th scope="col">Votes</th><th scope="col">Comments</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {live.map((d) => (
                    <tr key={d.id}>
                      <td><Link href={discussionPath(d)}>{d.question}</Link> {d.featured && <span className="fp-badge fp-badge--brand">Featured</span>} {d.status === "locked" && <span className="fp-badge">Closed</span>}</td>
                      <td>{label(d.gameId)}</td>
                      <td>{pollResults(d.id).total}</td>
                      <td>{commentCount(d.id)}</td>
                      <td><DiscussionActions id={d.id} status={d.status} featured={d.featured} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="fp-card" aria-labelledby="log-h">
            <h2 id="log-h" className="fp-section-title" style={{ marginBottom: 12 }}>Action history</h2>
            {log.length === 0 ? <p className="fp-meta">No actions yet.</p> : (
              <div className="fp-table-wrap">
                <table className="fp-table">
                  <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th></tr></thead>
                  <tbody>
                    {log.map((a) => (
                      <tr key={a.id}><td>{TIME.format(new Date(a.at))}</td><td>{a.actorName}</td><td>{a.action.replace(/_/g, " ")}{a.note ? ` (${a.note})` : ""}</td><td>{a.targetId}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

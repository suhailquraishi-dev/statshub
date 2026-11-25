"use client";

import { createContext, useContext, useId, useState } from "react";
import type { Period, Player, PlayerStatLine, Team, TeamResult } from "@/lib/data/types";
import { keyNumbers, tallySentence, type Comparison } from "@/lib/stats/compare";
import { formatValue, PERIOD_LABEL, PLAYER_METRICS } from "@/lib/data/metrics";
import { track } from "@/lib/analytics";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerAvatar } from "./PlayerAvatar";

/* One period for the whole matchup page, so every comparison and its
   explanation switch together (PRD F02). */
const PeriodCtx = createContext<{ period: Period; setPeriod: (p: Period) => void; gameId: string } | null>(null);

export function PeriodProvider({ gameId, children }: { gameId: string; children: React.ReactNode }) {
  const [period, set] = useState<Period>("season");
  const setPeriod = (p: Period) => {
    if (p === period) return;
    set(p);
    track("stat_comparison_changed", { matchup: gameId, period: p });
  };
  return <PeriodCtx.Provider value={{ period, setPeriod, gameId }}>{children}</PeriodCtx.Provider>;
}

function usePeriod() {
  const c = useContext(PeriodCtx);
  if (!c) throw new Error("usePeriod outside PeriodProvider");
  return c;
}

export function PeriodToggle({ label = "Stats period" }: { label?: string }) {
  const { period, setPeriod } = usePeriod();
  const opts: Period[] = ["season", "last5"];
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = period === "season" ? "last5" : "season";
      setPeriod(next);
      (e.currentTarget.querySelector(`[data-period="${next}"]`) as HTMLElement | null)?.focus();
    }
  }
  return (
    <div className="fp-seg" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {opts.map((p) => (
        <button key={p} type="button" role="radio" data-period={p} aria-checked={period === p} tabIndex={period === p ? 0 : -1} className="fp-seg__item" onClick={() => setPeriod(p)}>
          {PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

/** Ask the conversation on this page to open the reply box with this stat attached. */
export const USE_STAT_EVENT = "fp-use-stat";
export interface UseStatDetail { metricCode: string; period: Period }
function useStat(metricCode: string, period: Period, gameId: string) {
  track("stat_used_in_reply", { matchup: gameId, metric: metricCode, period });
  window.dispatchEvent(new CustomEvent<UseStatDetail>(USE_STAT_EVENT, { detail: { metricCode, period } }));
}

/**
 * Comparison table. Away team on the left, home on the right, everywhere.
 * Rows never move or disappear between periods: a stat the provider doesn't
 * have for this period says so.
 */
export function ComparisonTable({ c, home, away, caption, canReply }: { c: Comparison; home: Team; away: Team; caption: string; canReply?: boolean }) {
  const { gameId } = usePeriod();
  return (
    <table className="fp-compare">
      <caption className="sr-only">{caption}. {c.periodLabel}. {away.name} {c.sample.away} games, {home.name} {c.sample.home} games.</caption>
      <thead>
        <tr>
          <th scope="col" className="fp-compare__val fp-compare__val--l"><span className="fp-compare__team"><TeamLogo team={away} size="xs" />{away.name}</span></th>
          <th scope="col" style={{ textAlign: "center" }}>Stat</th>
          <th scope="col" className="fp-compare__val fp-compare__val--r"><span className="fp-compare__team"><TeamLogo team={home} size="xs" />{home.name}</span></th>
        </tr>
      </thead>
      <tbody>
        {c.rows.map((r) => {
          const missing = r.home === null || r.away === null;
          const max = Math.max(Math.abs(r.home ?? 0), Math.abs(r.away ?? 0), 1e-9);
          const w = (v: number | null) => `${v === null ? 0 : Math.max(4, (Math.abs(v) / max) * 100)}%`;
          return (
            <tr key={r.metric.code} className={missing ? "is-missing" : undefined}>
              <td className="fp-compare__val fp-compare__val--l">
                {r.away === null ? <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></> : r.awayText}
                {r.edge === "away" && <span className="fp-compare__edge">✓ Edge</span>}
              </td>
              <th scope="row" className="fp-compare__metric" style={{ textAlign: "center" }}>
                {r.metric.short}
                {missing ? (
                  <small>Not available for this period yet</small>
                ) : (
                  <>
                    <small>{r.metric.higherIsBetter ? "Higher is better" : "Lower is better"}</small>
                    <div className="fp-bars" aria-hidden="true">
                      <div className="fp-bar fp-bar--l"><span style={{ width: w(r.away) }} /></div>
                      <div className="fp-bar fp-bar--r"><span style={{ width: w(r.home) }} /></div>
                    </div>
                    {canReply && c.period !== "game" && (
                      <button type="button" className="fp-btn fp-btn--sm fp-btn--ghost fp-compare__use" onClick={() => useStat(r.metric.code, c.period as Period, gameId)}>
                        Use in my reply<span className="sr-only">: {r.metric.label}</span>
                      </button>
                    )}
                  </>
                )}
              </th>
              <td className="fp-compare__val fp-compare__val--r">
                {r.home === null ? <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></> : r.homeText}
                {r.edge === "home" && <span className="fp-compare__edge">✓ Edge</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Legend({ home, away }: { home: Team; away: Team }) {
  return (
    <div className="fp-legend" aria-hidden="true">
      <span><i style={{ background: "var(--fp-bar-away)" }} />{away.city} {away.name} (away)</span>
      <span><i style={{ background: "var(--fp-bar-home)" }} />{home.city} {home.name} (home)</span>
    </div>
  );
}

function SampleLine({ c, home, away }: { c: Comparison; home: Team; away: Team }) {
  return (
    <ul className="fp-meta-list">
      <li>{c.periodLabel}</li>
      <li>{c.season} {c.seasonType === "regular" ? "regular season" : "postseason"}</li>
      {c.period !== "game" && <li>{away.abbr} {c.sample.away} games, {home.abbr} {c.sample.home} games</li>}
      {c.period !== "game" && <li>Per-game averages unless noted</li>}
    </ul>
  );
}

/* ───── Key numbers: the two most decisive stats, first on the page ───── */

/** Which side of a result each points stat reads from. */
const GAME_VALUE: Record<string, { label: string; of: (r: TeamResult) => number }> = {
  pts_pg: { label: "scored", of: (r) => r.pf },
  pts_allowed_pg: { label: "allowed", of: (r) => r.pa },
  point_diff_pg: { label: "margin", of: (r) => r.pf - r.pa },
};

function GamesBehind({ code, teams, abbr }: { code: string; teams: { team: Team; form: TeamResult[]; text: string }[]; abbr: Record<string, string> }) {
  const g = GAME_VALUE[code];
  return (
    <div className="fp-behind">
      {teams.map(({ team, form, text }) => (
        <div key={team.id}>
          <p className="fp-behind__head"><TeamLogo team={team} size="xs" /><b>{team.name}</b><span className="fp-meta">average {text}</span></p>
          {form.length === 0 ? <p className="fp-meta">No finished games yet.</p> : (
            <ol className="fp-behind__list">
              {form.map((r) => (
                <li key={r.gameId}>
                  <span>{r.home ? "vs" : "at"} {abbr[r.opponentId] ?? r.opponentId.toUpperCase()} <span className="fp-meta">· {r.result} {r.pf}–{r.pa}</span></span>
                  <b>{g.of(r) > 0 && code === "point_diff_pg" ? "+" : ""}{g.of(r)} <span className="fp-meta">{g.label}</span></b>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

export function KeyNumbers({ data, home, away, homeForm, awayForm, abbr, canReply }: {
  data: Record<Period, Comparison>; home: Team; away: Team; homeForm: TeamResult[]; awayForm: TeamResult[]; abbr: Record<string, string>; canReply?: boolean;
}) {
  const { period, gameId } = usePeriod();
  const [open, setOpen] = useState<string | null>(null);
  const c = data[period];
  const rows = keyNumbers(c);
  const lines = [c.insights[0], ...c.insights.filter((s) => s.startsWith("Small sample"))].filter(Boolean);
  return (
    <div className="fp-stack-sm" aria-live="polite">
      {rows.length > 0 && (
        <div className="fp-keys">
          {rows.map((r) => {
            const canExplore = period === "last5" && r.metric.code in GAME_VALUE;
            const isOpen = open === r.metric.code;
            return (
              <div className="fp-key" key={r.metric.code}>
                <p className="fp-eyebrow">{r.metric.label} · {r.metric.higherIsBetter ? "higher is better" : "lower is better"}</p>
                <div className="fp-key__vals">
                  {[{ t: away, text: r.awayText, lead: r.edge === "away" }, { t: home, text: r.homeText, lead: r.edge === "home" }].map(({ t, text, lead }) => (
                    <p key={t.id} className={`fp-key__side${lead ? " is-lead" : ""}`}>
                      <span className="fp-key__team"><TeamLogo team={t} size="xs" />{t.name}</span>
                      <span className="fp-key__num">{text}</span>
                      {lead && <span className="fp-compare__edge">✓ Edge</span>}
                    </p>
                  ))}
                </div>
                <p className="fp-meta">{r.metric.meaning}</p>
                {(canExplore || canReply) && (
                  <div className="fp-btn-row">
                    {canExplore && (
                      <button type="button" className="fp-btn fp-btn--sm" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : r.metric.code); if (!isOpen) track("stat_explored", { matchup: gameId, metric: r.metric.code }); }}>
                        {isOpen ? "Hide the games" : `See the games behind ${r.edge === "home" ? r.homeText : r.awayText}`}
                      </button>
                    )}
                    {canReply && <button type="button" className="fp-btn fp-btn--sm" onClick={() => useStat(r.metric.code, period, gameId)}>Use this stat in my reply</button>}
                  </div>
                )}
                {canExplore && isOpen && (
                  <GamesBehind code={r.metric.code} abbr={abbr} teams={[{ team: away, form: awayForm, text: r.awayText }, { team: home, form: homeForm, text: r.homeText }]} />
                )}
              </div>
            );
          })}
        </div>
      )}
      <ul className="fp-insights">{lines.map((s) => <li key={s}>{s}</li>)}</ul>
    </div>
  );
}

/* ───── Explore all stats: one table, four views, same row order every time ───── */

const VIEWS = [
  { key: "key", label: "Key stats" },
  { key: "offense", label: "Offense" },
  { key: "defense", label: "Defense" },
  { key: "form", label: "Recent form" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

export function AllStats({ quick, categories, home, away, canReply }: {
  quick: Record<Period, Comparison>; categories: Record<"offense" | "defense" | "form", Record<Period, Comparison>>; home: Team; away: Team; canReply?: boolean;
}) {
  const { period } = usePeriod();
  const [view, setView] = useState<ViewKey>("key");
  const id = useId();
  const c = (view === "key" ? quick : categories[view])[period];
  function onKey(e: React.KeyboardEvent, i: number) {
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % VIEWS.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + VIEWS.length) % VIEWS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = VIEWS.length - 1;
    else return;
    e.preventDefault();
    setView(VIEWS[n].key);
    document.getElementById(`${id}-tab-${VIEWS[n].key}`)?.focus();
  }
  return (
    <div className="fp-stack-sm">
      <div className="fp-tabs" role="tablist" aria-label="Stat group">
        {VIEWS.map((t, i) => (
          <button key={t.key} id={`${id}-tab-${t.key}`} role="tab" type="button" className="fp-tab" aria-selected={view === t.key} aria-controls={`${id}-panel`} tabIndex={view === t.key ? 0 : -1} onClick={() => setView(t.key)} onKeyDown={(e) => onKey(e, i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${view}`} className="fp-stack-sm" aria-live="polite">
        <p className="fp-tally-line">{tallySentence(c, home, away)}</p>
        <Legend home={home} away={away} />
        <ComparisonTable c={c} home={home} away={away} canReply={canReply} caption={`${VIEWS.find((x) => x.key === view)!.label}: ${away.name} at ${home.name}`} />
        <SampleLine c={c} home={home} away={away} />
      </div>
    </div>
  );
}

/** One finished game's own numbers (postgame view). */
export function GameStats({ c, home, away }: { c: Comparison; home: Team; away: Team }) {
  return (
    <div className="fp-stack-sm">
      <p className="fp-tally-line">{tallySentence(c, home, away)}</p>
      <ComparisonTable c={c} home={home} away={away} caption={`This game: ${away.name} at ${home.name}`} />
      <ul className="fp-insights">{c.insights.slice(0, 2).map((s) => <li key={s}>{s}</li>)}</ul>
    </div>
  );
}

export interface PlayerBundle { player: Player; stats: Record<Period, PlayerStatLine> }

export function PlayerSpotlight({ home, away, homePlayers, awayPlayers }: { home: Team; away: Team; homePlayers: PlayerBundle[]; awayPlayers: PlayerBundle[] }) {
  const { period } = usePeriod();
  const positions = ["QB", "RB", "WR"] as const;
  const [pos, setPos] = useState<(typeof positions)[number]>("QB");
  const NAMES = { QB: "Quarterbacks", RB: "Running backs", WR: "Receivers" };
  const pick = (list: PlayerBundle[]) => list.find((b) => b.player.position === pos);
  return (
    <div className="fp-stack-sm">
      <div className="fp-seg fp-seg--full" role="group" aria-label="Position" style={{ maxWidth: 560 }}>
        {positions.map((p) => (
          <button key={p} type="button" className="fp-seg__item" aria-pressed={pos === p} onClick={() => setPos(p)}>{NAMES[p]}</button>
        ))}
      </div>
      <div className="fp-players">
        {[{ t: away, b: pick(awayPlayers) }, { t: home, b: pick(homePlayers) }].map(({ t, b }) => (
          <div className="fp-player" key={t.id}>
            <div className="fp-player__head">
              <PlayerAvatar name={b?.player.name} imageUrl={b?.player.imageUrl} team={t} />
              <div>
                <p className="fp-eyebrow">{t.city} {t.name} · {pos}</p>
                <p className="fp-card-title">{b?.player.name ?? "No player listed"}</p>
              </div>
            </div>
            {b && (
              <dl className="fp-player__stats">
                {PLAYER_METRICS.filter((m) => b.stats[period].values[m.code] !== null).map((m) => (
                  <div key={m.code}>
                    <dt>{m.short}</dt>
                    <dd>{formatValue(m, b.stats[period].values[m.code])}</dd>
                  </div>
                ))}
              </dl>
            )}
            {b && b.stats[period].gamesPlayed > 0 && <p className="fp-meta">{PERIOD_LABEL[period]} · {b.stats[period].gamesPlayed} games</p>}
            {b && b.stats[period].gamesPlayed === 0 && <p className="fp-meta">{PERIOD_LABEL[period]} numbers aren&apos;t available for this player yet.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PeriodNote() {
  const { period } = usePeriod();
  return <span>{PERIOD_LABEL[period]}</span>;
}

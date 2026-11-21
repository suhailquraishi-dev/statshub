"use client";

import { createContext, useContext, useId, useState } from "react";
import type { Period, Player, PlayerStatLine, Team } from "@/lib/data/types";
import type { Comparison } from "@/lib/stats/compare";
import { formatValue, PERIOD_LABEL, PLAYER_METRICS } from "@/lib/data/metrics";
import { track } from "@/lib/analytics";

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

export function ComparisonTable({ c, home, away, caption }: { c: Comparison; home: Team; away: Team; caption: string }) {
  return (
    <table className="fp-compare">
      <caption className="sr-only">{caption}. {c.periodLabel}. {home.name} {c.sample.home} games, {away.name} {c.sample.away} games.</caption>
      <thead>
        <tr>
          <th scope="col" className="fp-compare__val fp-compare__val--home">{home.abbr}</th>
          <th scope="col" style={{ textAlign: "center" }}>Stat</th>
          <th scope="col" className="fp-compare__val fp-compare__val--away">{away.abbr}</th>
        </tr>
      </thead>
      <tbody>
        {c.rows.map((r) => {
          const max = Math.max(Math.abs(r.home ?? 0), Math.abs(r.away ?? 0), 1e-9);
          const w = (v: number | null) => `${v === null ? 0 : Math.max(4, (Math.abs(v) / max) * 100)}%`;
          return (
            <tr key={r.metric.code}>
              <td className="fp-compare__val fp-compare__val--home">
                {r.homeText}
                {r.edge === "home" && <span className="fp-compare__edge">✓ Edge</span>}
              </td>
              <th scope="row" className="fp-compare__metric" style={{ textAlign: "center" }}>
                {r.metric.short}
                <small>{r.metric.higherIsBetter ? "Higher is better" : "Lower is better"}</small>
                <div className="fp-bars" aria-hidden="true">
                  <div className="fp-bar fp-bar--home"><span style={{ width: w(r.home) }} /></div>
                  <div className="fp-bar fp-bar--away"><span style={{ width: w(r.away) }} /></div>
                </div>
              </th>
              <td className="fp-compare__val fp-compare__val--away">
                {r.awayText}
                {r.edge === "away" && <span className="fp-compare__edge">✓ Edge</span>}
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
      <span><i style={{ background: "var(--fp-bar-home)" }} />{home.city} {home.name} (home)</span>
      <span><i style={{ background: "var(--fp-bar-away)" }} />{away.city} {away.name} (away)</span>
    </div>
  );
}

function SampleLine({ c, home, away }: { c: Comparison; home: Team; away: Team }) {
  return (
    <ul className="fp-meta-list">
      <li>{c.periodLabel}</li>
      <li>{c.season} {c.seasonType === "regular" ? "regular season" : "postseason"}</li>
      <li>{home.abbr} {c.sample.home} games, {away.abbr} {c.sample.away} games</li>
      <li>Per-game averages unless noted</li>
    </ul>
  );
}

export function QuickStats({ data, home, away }: { data: Record<Period, Comparison>; home: Team; away: Team }) {
  const { period } = usePeriod();
  const c = data[period];
  return (
    <div className="fp-stack-sm" aria-live="polite">
      <Legend home={home} away={away} />
      <ComparisonTable c={c} home={home} away={away} caption={`Key stats: ${home.name} vs ${away.name}`} />
      <SampleLine c={c} home={home} away={away} />
      <div>
        <h3 className="fp-eyebrow" style={{ marginBottom: 8 }}>What the numbers say</h3>
        <ul className="fp-insights">{c.insights.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
    </div>
  );
}

const CATS = [
  { key: "offense", label: "Offense" },
  { key: "defense", label: "Defense" },
  { key: "form", label: "Recent form" },
] as const;

export function TeamDetail({ data, home, away }: { data: Record<"offense" | "defense" | "form", Record<Period, Comparison>>; home: Team; away: Team }) {
  const { period } = usePeriod();
  const [cat, setCat] = useState<(typeof CATS)[number]["key"]>("offense");
  const id = useId();
  const c = data[cat][period];
  function onKey(e: React.KeyboardEvent, i: number) {
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % CATS.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + CATS.length) % CATS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = CATS.length - 1;
    else return;
    e.preventDefault();
    setCat(CATS[n].key);
    document.getElementById(`${id}-tab-${CATS[n].key}`)?.focus();
  }
  return (
    <div className="fp-stack-sm">
      <div className="fp-tabs" role="tablist" aria-label="Stat category">
        {CATS.map((t, i) => (
          <button key={t.key} id={`${id}-tab-${t.key}`} role="tab" type="button" className="fp-tab" aria-selected={cat === t.key} aria-controls={`${id}-panel`} tabIndex={cat === t.key ? 0 : -1} onClick={() => setCat(t.key)} onKeyDown={(e) => onKey(e, i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${cat}`} className="fp-stack-sm">
        <ComparisonTable c={c} home={home} away={away} caption={`${CATS.find((x) => x.key === cat)!.label}: ${home.name} vs ${away.name}`} />
        <SampleLine c={c} home={home} away={away} />
        <ul className="fp-insights">{c.insights.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
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
        {[{ t: home, b: pick(homePlayers) }, { t: away, b: pick(awayPlayers) }].map(({ t, b }) => (
          <div className="fp-player" key={t.id}>
            <div>
              <p className="fp-eyebrow">{t.city} {t.name} · {pos}</p>
              <p className="fp-card-title">{b?.player.name ?? "No player listed"}</p>
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
            {b && <p className="fp-meta">{PERIOD_LABEL[period]} · {b.stats[period].gamesPlayed} games</p>}
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

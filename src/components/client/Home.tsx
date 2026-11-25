"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Leaderboard, Team, TeamResult } from "@/lib/data/types";
import { TeamLogo } from "@/components/TeamLogo";
import { Chevron } from "@/components/Chevron";
import { PlayerAvatar } from "./PlayerAvatar";
import { track } from "@/lib/analytics";

/* ───── "My team": one choice per device, shared by every home section ───── */

const KEY = "fp-my-team";
const EVENT = "fp-my-team";

function readTeam(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function useMyTeam(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(readTeam());
    const on = () => setId(readTeam());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = (next: string | null) => {
    try { if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY); } catch { /* storage blocked: remember for this visit only */ }
    setId(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [id, set];
}

export interface TeamSummary {
  team: Team;
  record: string;
  division: string | null;
  next: { href: string; label: string; when: string } | null;
  form: TeamResult[];
}

export function MyTeam({ teams }: { teams: TeamSummary[] }) {
  const [myId, setMyId] = useMyTeam();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const abbr = Object.fromEntries(teams.map((s) => [s.team.id, s.team.abbr]));
  const mine = teams.find((s) => s.team.id === myId) ?? null;
  const sorted = [...teams].sort((a, b) => `${a.team.city} ${a.team.name}`.localeCompare(`${b.team.city} ${b.team.name}`));

  const open = () => dialog.current?.showModal();
  const choose = (id: string) => {
    setMyId(id);
    track("my_team_selected", { team: id });
    dialog.current?.close();
  };

  return (
    <>
      <button type="button" className="fp-btn fp-btn--sm fp-myteam-btn" onClick={open} aria-haspopup="dialog">
        {mine ? (
          <><TeamLogo team={mine.team} size="xs" /><span className="sr-only">My team: </span>{mine.team.name}</>
        ) : "Pick your team"}
        <Chevron direction="down" />
      </button>

      <dialog ref={dialog} className="fp-dialog fp-dialog--wide" aria-labelledby={titleId}>
        <div className="fp-dialog__body">
          <div className="fp-section-head" style={{ marginBottom: 0 }}>
            <h2 id={titleId} className="fp-card-title">{mine ? "My team" : "Pick your team"}</h2>
            <button type="button" className="fp-btn fp-btn--ghost fp-btn--sm" onClick={() => dialog.current?.close()}>Close</button>
          </div>
          {mine && (
            <div className="fp-myteam">
              <p className="fp-myteam__id">
                <TeamLogo team={mine.team} size="md" />
                <span><b>{mine.team.city} {mine.team.name}</b><br /><span className="fp-meta">{mine.record}{mine.division ? ` · ${mine.division}` : ""}</span></span>
              </p>
              {mine.form.length > 0 && (
                <p className="fp-myteam__form" aria-label={`Last ${mine.form.length} games, newest first: ${mine.form.map((r) => `${r.result} ${r.pf} to ${r.pa} ${r.home ? "against" : "at"} ${abbr[r.opponentId] ?? r.opponentId}`).join(", ")}`}>
                  <span className="fp-meta">Last {mine.form.length}:</span>
                  {mine.form.map((r) => <span key={r.gameId} aria-hidden="true" className={`fp-mybar__r fp-mybar__r--${r.result.toLowerCase()}`}>{r.result}</span>)}
                </p>
              )}
              {mine.next
                ? <Link href={mine.next.href} className="fp-btn fp-btn--primary" onClick={() => dialog.current?.close()}>Next game: {mine.next.label} <Chevron /></Link>
                : <p className="fp-meta">No game scheduled.</p>}
              <h3 className="fp-eyebrow">Change team</h3>
            </div>
          )}
          <ul className="fp-teampick">
            {sorted.map((s) => (
              <li key={s.team.id}>
                <button type="button" className="fp-teampick__btn" aria-pressed={s.team.id === myId} onClick={() => choose(s.team.id)}>
                  <TeamLogo team={s.team} size="sm" />
                  <span>{s.team.city} {s.team.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {mine && <button type="button" className="fp-btn fp-btn--ghost fp-btn--sm" onClick={() => { setMyId(null); dialog.current?.close(); }}>Clear my team</button>}
        </div>
      </dialog>
    </>
  );
}

/** Home shortcut to the reader's next game, once they have picked a team. */
export function MyTeamShortcut({ teams }: { teams: TeamSummary[] }) {
  const [myId] = useMyTeam();
  const mine = teams.find((s) => s.team.id === myId);
  if (!mine?.next) return null;
  return (
    <Link href={mine.next.href} className="fp-myshort">
      <TeamLogo team={mine.team} size="sm" />
      <span><b>Your team&apos;s next game:</b> {mine.team.name} {mine.next.label} <span className="fp-meta">· {mine.next.when}</span></span>
      <Chevron />
    </Link>
  );
}

/* ───── Standings ───── */

export interface StandingRow { team: Team; rank: number; w: number; l: number; t: number }

export function Standings({ divisions, fallback }: { divisions: Record<string, StandingRow[]>; fallback: string }) {
  const [myId] = useMyTeam();
  const names = Object.keys(divisions).sort();
  const myDivision = names.find((d) => divisions[d].some((r) => r.team.id === myId));
  const [picked, setPicked] = useState<string | null>(null);
  const division = picked ?? myDivision ?? (names.includes(fallback) ? fallback : names[0]);
  const rows = divisions[division] ?? [];
  const id = useId();
  if (names.length === 0) return null;
  const pct = (r: StandingRow) => {
    const gp = r.w + r.l + r.t;
    return gp ? ((r.w + r.t / 2) / gp).toFixed(3).replace(/^0/, "") : "—";
  };
  return (
    <section className="fp-card" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="fp-section-title fp-section-title--sm">Standings</h2>
      <div className="fp-field" style={{ marginBottom: 12 }}>
        <label className="fp-label" htmlFor={`${id}-d`}>Division</label>
        <select id={`${id}-d`} className="fp-select" value={division} onChange={(e) => setPicked(e.target.value)}>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <table className="fp-standings">
        <caption className="sr-only">{division} standings</caption>
        <thead><tr><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col"><abbr title="Win percentage">Pct</abbr></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} className={r.team.id === myId ? "is-mine" : undefined}>
              <th scope="row"><span className="fp-standings__team"><span className="fp-standings__rank">{r.rank}</span><TeamLogo team={r.team} size="xs" />{r.team.name}</span></th>
              <td>{r.w}</td><td>{r.l}{r.t ? `-${r.t}` : ""}</td><td>{pct(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ───── League leaders ───── */

export function Leaders({ boards, teams }: { boards: Leaderboard[]; teams: Team[] }) {
  const [i, setI] = useState(0);
  const id = useId();
  if (boards.length === 0) return null;
  const b = boards[Math.min(i, boards.length - 1)];
  const team = (tid: string) => teams.find((t) => t.id === tid);
  function onKey(e: React.KeyboardEvent, idx: number) {
    let n = idx;
    if (e.key === "ArrowRight") n = (idx + 1) % boards.length;
    else if (e.key === "ArrowLeft") n = (idx - 1 + boards.length) % boards.length;
    else return;
    e.preventDefault();
    setI(n);
    document.getElementById(`${id}-tab-${n}`)?.focus();
  }
  return (
    <section className="fp-card" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="fp-section-title fp-section-title--sm">League leaders</h2>
      <div className="fp-tabs fp-tabs--wrap" role="tablist" aria-label="Stat">
        {boards.map((x, idx) => (
          <button key={x.code} id={`${id}-tab-${idx}`} type="button" role="tab" className="fp-tab" aria-selected={idx === i} aria-controls={`${id}-panel`} tabIndex={idx === i ? 0 : -1} onClick={() => setI(idx)} onKeyDown={(e) => onKey(e, idx)}>
            {x.label.replace(" yards", "")}
          </button>
        ))}
      </div>
      <ol id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`} className="fp-leaders">
        {b.rows.map((r) => {
          const t = team(r.teamId);
          return (
            <li key={`${r.rank}-${r.playerName}`}>
              <span className="fp-leaders__rank">{r.rank}</span>
              <PlayerAvatar name={r.playerName} imageUrl={r.imageUrl} team={t} size="sm" />
              <span className="fp-leaders__who"><b>{r.playerName}</b><span className="fp-meta">{t?.abbr ?? r.teamId.toUpperCase()}</span></span>
              <span className="fp-leaders__val">{r.value.toLocaleString()}</span>
            </li>
          );
        })}
      </ol>
      <p className="fp-hint">{b.label}, season total.</p>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EvidenceRequest, EvidenceSnapshot } from "@/lib/stats/evidence";
import { formatValue, PLAYER_METRICS, TEAM_METRICS } from "@/lib/data/metrics";
import type { MetricDef, Period } from "@/lib/data/types";
import { api, ApiError } from "@/lib/client-api";

const ALL = [...TEAM_METRICS, ...PLAYER_METRICS];
function metricOf(snap: EvidenceSnapshot): MetricDef {
  const list = snap.kind === "team" ? TEAM_METRICS : PLAYER_METRICS;
  return list.find((m) => m.code === snap.metricCode) ?? ALL.find((m) => m.code === snap.metricCode)!;
}

const STAMP = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });

export function EvidenceCard({ snap, state = "current", preview }: { snap: EvidenceSnapshot; state?: "current" | "superseded"; preview?: boolean }) {
  const m = metricOf(snap);
  const vals = snap.entities.map((e) => Math.abs(e.value ?? 0));
  const max = Math.max(...vals, 1e-9);
  let leader: string | null = null;
  if (snap.entities.length === 2 && snap.entities.every((e) => e.value !== null) && snap.entities[0].value !== snap.entities[1].value) {
    const [a, b] = snap.entities;
    leader = ((a.value! > b.value!) === snap.higherIsBetter ? a : b).id;
  }
  return (
    <figure className={`fp-evidence${state === "superseded" ? " fp-evidence--superseded" : ""}`} style={{ margin: 0 }} aria-label={`Evidence: ${snap.metricLabel}`}>
      <div className="fp-evidence__head">
        <span className="fp-badge fp-badge--brand">{preview ? "Preview · " : ""}Stat evidence</span>
        {state === "superseded" && <span className="fp-badge fp-badge--warn">Corrected since posting</span>}
      </div>
      <figcaption>
        <span className="fp-evidence__metric">{snap.metricLabel}</span>
        <span className="fp-meta"> · {snap.windowLabel} · {snap.season} {snap.seasonType === "regular" ? "regular season" : "postseason"} · {m.higherIsBetter ? "higher is better" : "lower is better"}</span>
      </figcaption>
      <div className="fp-evidence__vals">
        {snap.entities.map((e) => (
          <div className="fp-evidence__row" key={e.id}>
            <span>{e.label}{leader === e.id && <span className="fp-compare__edge" style={{ display: "inline", marginLeft: 8 }}>✓ Edge</span>} <span className="fp-meta">({e.sampleSize} games)</span></span>
            <span className="fp-evidence__num">{formatValue(m, e.value)}</span>
            <div className={`fp-result__bar${leader === e.id ? " fp-result--mine" : ""}`} aria-hidden="true">
              <span style={{ width: `${Math.max(4, (Math.abs(e.value ?? 0) / max) * 100)}%`, background: leader === e.id ? "var(--fp-bar-home)" : undefined }} />
            </div>
          </div>
        ))}
      </div>
      <p className="fp-evidence__foot">
        Source: {snap.provider} · Data as of {STAMP.format(new Date(snap.ingestedAt))} · Snapshot {snap.snapshotId.slice(0, 12)} · {snap.calcVersion}
        {state === "superseded" && " · The provider has since corrected these numbers; this card shows them as they were when posted."}
        <br />Evidence supports an argument; it doesn&apos;t prove it right.
        {snap.contextGameId && <> <Link href={`/fanpulse/nfl/matchups/${snap.contextGameId}`}>See full comparison</Link></>}
      </p>
    </figure>
  );
}

export interface EvidenceOptions {
  gameId: string;
  teams: { id: string; label: string }[];
  players: { id: string; label: string; position: string; teamId: string }[];
  defaultTeams: [string, string];
}

/** Pick a metric, period and entities; preview; attach (PRD §7). */
export function EvidenceBuilder({ opts, onAttach, onCancel }: { opts: EvidenceOptions; onAttach: (req: EvidenceRequest, snap: EvidenceSnapshot) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<"team" | "player">("team");
  const [metric, setMetric] = useState(TEAM_METRICS[0].code);
  const [period, setPeriod] = useState<Period>("season");
  const [a, setA] = useState(opts.defaultTeams[0]);
  const [b, setB] = useState(opts.defaultTeams[1]);
  const [preview, setPreview] = useState<EvidenceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const metrics = kind === "team" ? TEAM_METRICS : PLAYER_METRICS;
  const entities = useMemo(
    () => (kind === "team" ? opts.teams : opts.players.map((p) => ({ id: p.id, label: `${p.label} (${p.position}, ${opts.teams.find((t) => t.id === p.teamId)?.label ?? ""})` }))),
    [kind, opts],
  );

  function switchKind(k: "team" | "player") {
    setKind(k);
    setPreview(null);
    setError("");
    if (k === "team") { setMetric(TEAM_METRICS[0].code); setA(opts.defaultTeams[0]); setB(opts.defaultTeams[1]); }
    else {
      setMetric("pass_yds_pg");
      const qbs = opts.players.filter((p) => p.position === "QB" && opts.defaultTeams.includes(p.teamId));
      setA(qbs[0]?.id ?? opts.players[0].id);
      setB(qbs[1]?.id ?? "");
    }
  }

  const req = (): EvidenceRequest => ({ kind, metricCode: metric, period, season: 2026, entityIds: [a, b].filter(Boolean), contextGameId: opts.gameId });

  async function doPreview() {
    setBusy(true);
    setError("");
    try {
      const { preview: p } = await api<{ preview: EvidenceSnapshot }>("/api/v1/evidence/preview", { body: req() });
      setPreview(p);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError ? err.message.replace("Incompatible comparison: ", "These can't be compared: ") : "Preview failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPreview(null); setError(""); };

  return (
    <div className="fp-callout fp-stack-sm" role="group" aria-label="Add a stat as evidence">
      <p style={{ fontWeight: 600 }}>Add a stat as evidence</p>
      <div className="fp-seg" role="group" aria-label="Compare">
        <button type="button" className="fp-seg__item" aria-pressed={kind === "team"} onClick={() => switchKind("team")}>Teams</button>
        <button type="button" className="fp-seg__item" aria-pressed={kind === "player"} onClick={() => switchKind("player")}>Players</button>
      </div>
      <div className="fp-grid-2" style={{ gap: 12 }}>
        <div className="fp-field">
          <label className="fp-label" htmlFor="ev-metric">Stat</label>
          <select id="ev-metric" className="fp-select" value={metric} onChange={(e) => change(setMetric)(e.target.value)}>
            {metrics.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
        </div>
        <div className="fp-field">
          <label className="fp-label" htmlFor="ev-period">Period</label>
          <select id="ev-period" className="fp-select" value={period} onChange={(e) => change(setPeriod)(e.target.value as Period)}>
            <option value="season">Full season</option>
            <option value="last5">Last 5 games</option>
          </select>
        </div>
        <div className="fp-field">
          <label className="fp-label" htmlFor="ev-a">{kind === "team" ? "Team" : "Player"}</label>
          <select id="ev-a" className="fp-select" value={a} onChange={(e) => change(setA)(e.target.value)}>
            {entities.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div className="fp-field">
          <label className="fp-label" htmlFor="ev-b">Compare with (optional)</label>
          <select id="ev-b" className="fp-select" value={b} onChange={(e) => change(setB)(e.target.value)}>
            <option value="">No comparison</option>
            {entities.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="fp-error" role="alert">{error}</p>}
      {preview && <EvidenceCard snap={preview} preview />}
      <div className="fp-btn-row">
        {preview ? (
          <button type="button" className="fp-btn" onClick={() => onAttach(req(), preview)}>Attach to my comment</button>
        ) : (
          <button type="button" className="fp-btn" onClick={doPreview} disabled={busy}>{busy ? "Loading…" : "Preview stat"}</button>
        )}
        <button type="button" className="fp-btn fp-btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

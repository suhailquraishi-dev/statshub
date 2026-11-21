import type { Period, SeasonType, Unit, Aggregation } from "@/lib/data/types";
import type { StatsProvider } from "@/lib/data/provider";
import { PERIOD_LABEL, playerMetric, teamMetric } from "@/lib/data/metrics";
import { assertCompatible, IncompatibleComparisonError, type ComparableSample } from "./compare";

export const CALC_VERSION = "compare-v1";

export type EntityKind = "team" | "player";

export interface EvidenceRequest {
  kind: EntityKind;
  metricCode: string;
  period: Period;
  season: number;
  entityIds: string[]; // internal ids, 1 or 2
  /** Link back to the comparison this came from. */
  contextGameId?: string;
}

export interface EvidenceEntity {
  id: string;
  providerId: string;
  label: string;
  value: number | null;
  sampleSize: number;
}

/**
 * Immutable evidence snapshot (PRD §7 contract). Stored once and never
 * edited; a later provider correction marks it superseded at read time.
 */
export interface EvidenceSnapshot {
  readonly snapshotId: string;
  readonly provider: string;
  readonly isDemo: boolean;
  readonly kind: EntityKind;
  readonly metricCode: string;
  readonly metricLabel: string;
  readonly unit: Unit;
  readonly aggregation: Aggregation;
  readonly higherIsBetter: boolean;
  readonly competition: "NFL";
  readonly season: number;
  readonly seasonType: SeasonType;
  readonly period: Period;
  readonly windowLabel: string;
  readonly entities: readonly EvidenceEntity[];
  readonly ingestedAt: string;
  readonly calcVersion: string;
  readonly createdAt: string;
  readonly contextGameId?: string;
}

export type EvidenceState = "current" | "superseded";

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

function resolve(provider: StatsProvider, req: EvidenceRequest): { samples: ComparableSample[]; entities: EvidenceEntity[] } {
  const metric = req.kind === "team" ? teamMetric(req.metricCode) : playerMetric(req.metricCode);
  const samples: ComparableSample[] = [];
  const entities: EvidenceEntity[] = [];
  for (const id of req.entityIds) {
    if (req.kind === "team") {
      const team = provider.team(id);
      if (!team) throw new IncompatibleComparisonError(`unknown team ${id}`);
      const line = provider.teamStats(id, req.season, req.period);
      const value = line.values[metric.code] ?? null;
      samples.push({ metric, season: line.season, seasonType: line.seasonType, period: line.period, value, gamesPlayed: line.gamesPlayed });
      entities.push({ id, providerId: team.providerId, label: `${team.city} ${team.name}`, value, sampleSize: line.gamesPlayed });
    } else {
      const p = provider.player(id);
      if (!p) throw new IncompatibleComparisonError(`unknown player ${id}`);
      const line = provider.playerStats(id, req.season, req.period);
      const value = line.values[metric.code] ?? null;
      if (value === null) throw new IncompatibleComparisonError(`${p.name} has no ${metric.label.toLowerCase()}`);
      samples.push({ metric, season: line.season, seasonType: line.seasonType, period: line.period, value, gamesPlayed: line.gamesPlayed });
      entities.push({ id, providerId: p.providerId, label: p.name, value, sampleSize: line.gamesPlayed });
    }
  }
  return { samples, entities };
}

export function createEvidenceSnapshot(provider: StatsProvider, req: EvidenceRequest, now = new Date()): EvidenceSnapshot {
  if (req.entityIds.length < 1 || req.entityIds.length > 2) throw new IncompatibleComparisonError("pick one or two teams or players");
  if (new Set(req.entityIds).size !== req.entityIds.length) throw new IncompatibleComparisonError("pick two different entities");
  const metric = req.kind === "team" ? teamMetric(req.metricCode) : playerMetric(req.metricCode);
  const { samples, entities } = resolve(provider, req);
  if (samples.length === 2) assertCompatible(samples[0], samples[1]);
  const fresh = provider.freshness();
  const body = {
    provider: provider.name,
    isDemo: provider.isDemo,
    kind: req.kind,
    metricCode: metric.code,
    metricLabel: metric.label,
    unit: metric.unit,
    aggregation: metric.aggregation,
    higherIsBetter: metric.higherIsBetter,
    competition: "NFL" as const,
    season: samples[0].season,
    seasonType: samples[0].seasonType,
    period: req.period,
    windowLabel: PERIOD_LABEL[req.period],
    entities,
    ingestedAt: fresh.ingestedAt,
    calcVersion: CALC_VERSION,
    createdAt: now.toISOString(),
    contextGameId: req.contextGameId,
  };
  const snapshotId = `ev_${hash(JSON.stringify(body))}${hash(now.toISOString() + Math.random())}`;
  return deepFreeze({ snapshotId, ...body });
}

/** Compare a stored snapshot with the provider's current values (corrections flag it superseded). */
export function evidenceState(provider: StatsProvider, snap: EvidenceSnapshot): EvidenceState {
  try {
    const { entities } = resolve(provider, {
      kind: snap.kind, metricCode: snap.metricCode, period: snap.period, season: snap.season,
      entityIds: snap.entities.map((e) => e.id),
    });
    // Period-based numbers drift as games are played; only a change in the
    // same sample (same games played) is a correction.
    const corrected = entities.some((e, i) => e.sampleSize === snap.entities[i].sampleSize && e.value !== snap.entities[i].value);
    return corrected ? "superseded" : "current";
  } catch {
    return "superseded";
  }
}

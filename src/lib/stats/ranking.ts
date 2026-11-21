/**
 * Discovery ranking with the PRD §8 starting weights. These are a hypothesis
 * to test, not proven values, so they live in one place.
 */
export const RANK_WEIGHTS = {
  participation: 0.25,
  relevance: 0.25,
  significance: 0.2,
  freshness: 0.15,
  quality: 0.15,
} as const;

export interface RankInput {
  recentComments: number;
  distinctAuthors: number;
  votes: number;
  evidenceComments: number;
  /** 0..1: does this match the viewer's followed teams? 0.5 when unknown. */
  relevance: number;
  /** 0..1: how notable is the stat behind the question. */
  significance: number;
  createdAt: string;
  featured: boolean;
  /** Spam / manipulation penalty, 0..1, subtracted at the end. */
  penalty?: number;
}

const sat = (x: number, k: number) => 1 - Math.exp(-x / k); // 0..1 saturating curve

export function rankScore(i: RankInput, now = Date.now()): number {
  const ageH = Math.max(0, (now - Date.parse(i.createdAt)) / 3600_000);
  const participation = sat(i.recentComments + i.votes * 0.2, 10);
  const freshness = Math.exp(-ageH / 48);
  const diversity = i.recentComments ? i.distinctAuthors / i.recentComments : 0;
  const evidenceShare = i.recentComments ? i.evidenceComments / i.recentComments : 0;
  const quality = 0.5 * diversity + 0.5 * evidenceShare;
  const score =
    RANK_WEIGHTS.participation * participation +
    RANK_WEIGHTS.relevance * i.relevance +
    RANK_WEIGHTS.significance * i.significance +
    RANK_WEIGHTS.freshness * freshness +
    RANK_WEIGHTS.quality * quality;
  return Math.max(0, score - (i.penalty ?? 0)) + (i.featured ? 0.05 : 0);
}

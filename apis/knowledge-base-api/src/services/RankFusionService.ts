import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';

export interface Ranking {
    /** Ids, best first. */
    readonly ids: readonly string[];
    /** Multiplies this list's contribution. 1 everywhere is plain RRF; 0 ignores the list. */
    readonly weight: number;
}

export interface FusedHit {
    readonly id: string;
    /** Σ weight / (k + rank) over every list the id appears in; rank is 1-based. */
    readonly score: number;
}

/**
 * Reciprocal rank fusion: merges ranked lists that score on incomparable scales (`ts_rank_cd`
 * and cosine distance) by rank alone. An id high in both lists beats one that tops only one.
 *
 * Ties are broken by the best rank the id reached in any list, then by first appearance, so
 * the order is deterministic for the same inputs.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class RankFusionService {
    public fuse(rankings: readonly Ranking[], k: number): FusedHit[] {
        const hits = new Map<string, { score: number; bestRank: number; firstSeen: number }>();
        let seen = 0;

        for (const ranking of rankings) {
            if (ranking.weight <= 0) {
                continue;
            }

            // A list naming one id twice counts it once, at its better rank.
            [...new Set(ranking.ids)].forEach((id, index) => {
                const rank = index + 1;
                const contribution = ranking.weight / (k + rank);
                const hit = hits.get(id);

                if (CommonUtils.isUndefined(hit)) {
                    hits.set(id, { score: contribution, bestRank: rank, firstSeen: seen++ });
                } else {
                    hit.score += contribution;
                    hit.bestRank = Math.min(hit.bestRank, rank);
                }
            });
        }

        return [...hits.entries()]
            .sort(([, a], [, b]) => b.score - a.score || a.bestRank - b.bestRank || a.firstSeen - b.firstSeen)
            .map(([id, hit]) => ({ id, score: hit.score }));
    }
}

import type { FusionStrategy, ProviderSearchOutput, FusionContext } from "../../../types/ensemble"
import { computeDeduplicationKey } from "../dedup"

/**
 * Reciprocal Rank Fusion (RRF) strategy.
 *
 * Combines results from multiple providers using the formula:
 *
 * ```
 * score(d) = Σ over providers [ 1 / (k + rank(d)) ]
 * ```
 *
 * RRF is parameter-free (aside from `k`, typically 60) and well-studied
 * in information retrieval literature. It handles different scoring scales
 * across providers naturally since it only uses rank positions, not raw scores.
 *
 * Results appearing in multiple providers accumulate higher RRF scores,
 * naturally boosting documents with cross-provider agreement.
 *
 * @see {@link https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf | Cormack et al. (2009)}
 *
 * @example
 * ```ts
 * const rrf = new RRFStrategy({ k: 60 })
 * const fused = await rrf.fuse(providerResults, { query: "...", limit: 10 })
 * ```
 */
export class RRFStrategy implements FusionStrategy {
  name = "rrf"
  /** Smoothing constant for the RRF formula. Higher values reduce the impact of rank differences. */
  private k: number

  /**
   * @param config - Strategy configuration
   * @param config.k - RRF smoothing constant (default: 60). Higher values flatten the rank curve.
   */
  constructor(config: { k?: number }) {
    this.k = config.k ?? 60
  }

  /**
   * Fuse results from multiple providers using Reciprocal Rank Fusion.
   *
   * For each result across all providers, computes `1 / (k + rank)` and accumulates
   * scores for duplicates (identified by content hash). Returns results sorted by
   * descending RRF score, capped at `context.limit`.
   *
   * @param providerResults - Search outputs from each sub-provider
   * @param context - Fusion context with query string and result limit
   * @returns Fused results sorted by RRF score (highest first)
   */
  async fuse(
    providerResults: ProviderSearchOutput[],
    context: FusionContext
  ): Promise<unknown[]> {
    const scores = new Map<string, { score: number; result: unknown }>()

    for (const pr of providerResults) {
      for (let rank = 0; rank < pr.results.length; rank++) {
        const result = pr.results[rank]
        const key = computeDeduplicationKey(result)
        const rrfScore = 1 / (this.k + rank + 1)

        if (scores.has(key)) {
          scores.get(key)!.score += rrfScore
        } else {
          scores.set(key, { score: rrfScore, result })
        }
      }
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, context.limit)
      .map((s) => s.result)
  }
}

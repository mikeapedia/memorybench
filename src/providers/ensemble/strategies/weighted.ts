import type { FusionStrategy, ProviderSearchOutput, FusionContext } from "../../../types/ensemble"
import { computeDeduplicationKey, extractScore } from "../dedup"

/**
 * Weighted scoring fusion strategy.
 *
 * Applies per-provider weights to each result's native relevance score.
 * If no native score is available (the provider doesn't return scores),
 * falls back to inverse rank scoring: `1 / (rank + 1)`.
 *
 * Results appearing in multiple providers accumulate weighted scores,
 * allowing high-weight providers to dominate the final ranking while
 * still benefiting from cross-provider agreement.
 *
 * Provider weights are set in the ensemble config:
 * ```json
 * { "name": "supermemory", "weight": 1.5 }
 * ```
 *
 * @example
 * ```ts
 * const weighted = new WeightedStrategy()
 * // Weights come from ProviderSearchOutput.weight (set by EnsembleProvider)
 * const fused = await weighted.fuse(providerResults, { query: "...", limit: 10 })
 * ```
 */
export class WeightedStrategy implements FusionStrategy {
  name = "weighted"

  /**
   * Fuse results using weighted scoring.
   *
   * For each result, computes: `weight * nativeScore` (or `weight * (1 / (rank + 1))` as fallback).
   * Duplicate results across providers accumulate their weighted scores. Final results are
   * sorted by total weighted score in descending order.
   *
   * @param providerResults - Search outputs from each sub-provider, each tagged with a weight
   * @param context - Fusion context with query string and result limit
   * @returns Results sorted by weighted score (highest first)
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
        const nativeScore = extractScore(result) ?? 1 / (rank + 1)
        const weightedScore = nativeScore * pr.weight

        if (scores.has(key)) {
          scores.get(key)!.score += weightedScore
        } else {
          scores.set(key, { score: weightedScore, result })
        }
      }
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, context.limit)
      .map((s) => s.result)
  }
}

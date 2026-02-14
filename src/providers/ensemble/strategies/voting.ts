import type { FusionStrategy, ProviderSearchOutput, FusionContext } from "../../../types/ensemble"
import { computeDeduplicationKey } from "../dedup"

/**
 * Majority voting fusion strategy.
 *
 * Results appearing in multiple providers are ranked higher. Each provider
 * contributes one "vote" per unique result. Ties in vote count are broken
 * by average rank position across providers (lower average rank = higher priority).
 *
 * A configurable `threshold` controls the minimum number of votes a result needs
 * to be included in the output. Setting `threshold: 2` requires results to appear
 * in at least 2 providers, effectively filtering out provider-specific noise.
 *
 * @example
 * ```ts
 * // Require results to appear in at least 2 out of 3 providers
 * const voting = new VotingStrategy({ threshold: 2 })
 * const fused = await voting.fuse(providerResults, { query: "...", limit: 10 })
 * ```
 */
export class VotingStrategy implements FusionStrategy {
  name = "voting"
  /** Minimum number of provider votes required for a result to be included. */
  private threshold: number

  /**
   * @param config - Strategy configuration
   * @param config.threshold - Minimum vote count to include a result (default: 1, i.e., no filtering)
   */
  constructor(config: { threshold?: number }) {
    this.threshold = config.threshold ?? 1
  }

  /**
   * Fuse results using majority voting with average-rank tiebreaking.
   *
   * For each unique result (by content hash):
   * - Counts how many providers returned it (votes)
   * - Tracks its rank position in each provider
   * - Computes average rank across all providers that returned it
   *
   * Results are sorted by: (1) descending vote count, (2) ascending average rank.
   * Only results meeting the vote threshold are included.
   *
   * @param providerResults - Search outputs from each sub-provider
   * @param context - Fusion context with query string and result limit
   * @returns Results sorted by vote count (ties broken by average rank), filtered by threshold
   */
  async fuse(
    providerResults: ProviderSearchOutput[],
    context: FusionContext
  ): Promise<unknown[]> {
    const voteMap = new Map<
      string,
      {
        votes: number
        avgRank: number
        rankSum: number
        result: unknown
      }
    >()

    for (const pr of providerResults) {
      for (let rank = 0; rank < pr.results.length; rank++) {
        const result = pr.results[rank]
        const key = computeDeduplicationKey(result)

        if (voteMap.has(key)) {
          const entry = voteMap.get(key)!
          entry.votes++
          entry.rankSum += rank
          entry.avgRank = entry.rankSum / entry.votes
        } else {
          voteMap.set(key, {
            votes: 1,
            avgRank: rank,
            rankSum: rank,
            result,
          })
        }
      }
    }

    return Array.from(voteMap.values())
      .filter((v) => v.votes >= this.threshold)
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes
        return a.avgRank - b.avgRank
      })
      .slice(0, context.limit)
      .map((v) => v.result)
  }
}

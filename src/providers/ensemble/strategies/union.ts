import type { FusionStrategy, ProviderSearchOutput, FusionContext } from "../../../types/ensemble"
import { computeDeduplicationKey } from "../dedup"

/**
 * Union strategy with content-based deduplication.
 *
 * The simplest fusion approach: concatenates all results from all providers
 * in order (first provider's results first, then second, etc.) and removes
 * duplicates by content hash. The first occurrence of each unique result is kept.
 *
 * Best suited for scenarios where provider overlap is low and you want
 * maximum coverage of diverse results.
 *
 * @example
 * ```ts
 * const union = new UnionStrategy()
 * const fused = await union.fuse(providerResults, { query: "...", limit: 10 })
 * ```
 */
export class UnionStrategy implements FusionStrategy {
  name = "union"

  /**
   * Merge results from all providers with deduplication.
   *
   * Iterates through provider results in config order, skipping any result
   * whose content hash has already been seen. Returns up to `context.limit` results.
   *
   * @param providerResults - Search outputs from each sub-provider
   * @param context - Fusion context with query string and result limit
   * @returns Deduplicated union of all results, preserving provider ordering
   */
  async fuse(
    providerResults: ProviderSearchOutput[],
    context: FusionContext
  ): Promise<unknown[]> {
    const seen = new Set<string>()
    const merged: unknown[] = []

    for (const pr of providerResults) {
      for (const result of pr.results) {
        const key = computeDeduplicationKey(result)
        if (!seen.has(key)) {
          seen.add(key)
          merged.push(result)
        }
      }
    }

    return merged.slice(0, context.limit)
  }
}

import type { ProviderName } from "./provider"

/**
 * Entry in an ensemble configuration specifying a sub-provider and its optional weight.
 *
 * @example
 * ```json
 * { "name": "supermemory", "weight": 1.2 }
 * ```
 */
export interface EnsembleProviderEntry {
  /** Name of the sub-provider to include in the ensemble */
  name: ProviderName
  /** Relative weight for fusion strategies that support weighting (default: 1.0) */
  weight?: number
}

/** Union of all available fusion strategy names. */
export type StrategyName = "union" | "rrf" | "weighted" | "llm-rerank" | "voting"

/**
 * Discriminated union of strategy configurations.
 * Each variant includes strategy-specific parameters.
 *
 * - `union` — Simple merge with deduplication, no parameters
 * - `rrf` — Reciprocal Rank Fusion with tunable k (default: 60)
 * - `weighted` — Per-provider weighted scoring using native scores or inverse rank
 * - `llm-rerank` — LLM-based re-ranking of combined results (default model: gpt-4o-mini)
 * - `voting` — Majority voting, results in N+ providers ranked higher (default threshold: 2)
 */
export type StrategyConfig =
  | { name: "union" }
  | { name: "rrf"; k?: number }
  | { name: "weighted" }
  | { name: "llm-rerank"; model?: string }
  | { name: "voting"; threshold?: number }

/**
 * Top-level ensemble configuration loaded from a JSON file via `--ensemble-config`.
 * Specifies which providers to combine and which fusion strategy to use.
 *
 * @example
 * ```json
 * {
 *   "providers": [
 *     { "name": "supermemory" },
 *     { "name": "mem0", "weight": 1.2 }
 *   ],
 *   "strategy": { "name": "rrf", "k": 60 }
 * }
 * ```
 */
export interface EnsembleConfig {
  /** Sub-providers to query in parallel */
  providers: EnsembleProviderEntry[]
  /** Fusion strategy for combining search results */
  strategy: StrategyConfig
}

/**
 * Output from a single sub-provider's search, used as input to the fusion strategy.
 * Collected by `EnsembleProvider.search()` before being passed to `FusionStrategy.fuse()`.
 */
export interface ProviderSearchOutput {
  /** Name of the sub-provider that produced these results */
  providerName: string
  /** Index of the provider in the ensemble config's providers array */
  providerIndex: number
  /** Raw search results from this provider (provider-specific format) */
  results: unknown[]
  /** Time in milliseconds this provider took to return results */
  latencyMs: number
  /** Weight assigned to this provider (from config, default 1.0) */
  weight: number
}

/**
 * Context passed to a fusion strategy alongside the provider results.
 * Contains the original query and configuration needed for fusion decisions.
 */
export interface FusionContext {
  /** The original search query */
  query: string
  /** Maximum number of fused results to return */
  limit: number
  /** Full ensemble configuration (for accessing provider weights, strategy params) */
  ensembleConfig: EnsembleConfig
}

/**
 * Interface that all fusion strategies must implement.
 * A strategy takes results from multiple providers and produces a single ranked list.
 *
 * @example
 * ```ts
 * class MyStrategy implements FusionStrategy {
 *   name = "my-strategy"
 *   async fuse(providerResults, context) {
 *     // Combine and rank results
 *     return rankedResults.slice(0, context.limit)
 *   }
 * }
 * ```
 */
export interface FusionStrategy {
  /** Unique name identifying this strategy */
  name: string
  /**
   * Combine results from multiple providers into a single ranked list.
   * @param providerResults - Search outputs from each sub-provider
   * @param context - Query, limit, and ensemble configuration
   * @returns Fused and ranked results, truncated to `context.limit`
   */
  fuse(providerResults: ProviderSearchOutput[], context: FusionContext): Promise<unknown[]>
}

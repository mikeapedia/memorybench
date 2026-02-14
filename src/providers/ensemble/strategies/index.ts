import type { FusionStrategy, StrategyConfig } from "../../../types/ensemble"
import { UnionStrategy } from "./union"
import { RRFStrategy } from "./rrf"
import { WeightedStrategy } from "./weighted"
import { LLMRerankStrategy } from "./llm-rerank"
import { VotingStrategy } from "./voting"

/**
 * Factory function that creates a {@link FusionStrategy} instance from a strategy config.
 *
 * Uses a discriminated union on `config.name` to instantiate the appropriate strategy class.
 * Each strategy receives its own config parameters (e.g., `k` for RRF, `model` for LLM-rerank).
 *
 * @param config - Strategy configuration with a `name` discriminant and strategy-specific params
 * @returns An initialized FusionStrategy ready for `fuse()` calls
 * @throws {Error} If `config.name` doesn't match any registered strategy
 *
 * @example
 * ```ts
 * const strategy = createStrategy({ name: "rrf", k: 60 })
 * const fused = await strategy.fuse(providerResults, context)
 * ```
 */
export function createStrategy(config: StrategyConfig): FusionStrategy {
  switch (config.name) {
    case "union":
      return new UnionStrategy()
    case "rrf":
      return new RRFStrategy(config)
    case "weighted":
      return new WeightedStrategy()
    case "llm-rerank":
      return new LLMRerankStrategy(config)
    case "voting":
      return new VotingStrategy(config)
    default:
      throw new Error(`Unknown fusion strategy: ${(config as { name: string }).name}`)
  }
}

export { UnionStrategy, RRFStrategy, WeightedStrategy, LLMRerankStrategy, VotingStrategy }
